import { Injectable } from '@nestjs/common';
import { mapWithConcurrency } from '../common/batch-map.util';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

const ACTIVITY_CACHE_TTL_SECONDS = 90;

@Injectable()
export class AdminActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: CacheService,
  ) {}

  /**
   * `platform_activities` tem RLS normal — mesmo padrão de soma por tenant
   * já usado em Dashboard/Subscriptions/Payments/Payouts (TenantContextService,
   * sem bypass de RLS novo). Cada tenant já traz só as últimas `limit` linhas
   * suas, o suficiente pra montar o merge final sem buscar todo o histórico.
   *
   * Cache de 90s (chave inclui `limit` — cada valor pedido tem seu próprio
   * cache) no resultado já ordenado e cortado, mesmo cuidado de Payments/Payouts
   * com o `.sort` por `createdAt` rodando só antes de cachear.
   */
  async list(limit: number) {
    const cacheKey = `admin:activity:${limit}`;
    const cached = await this.cache.get<Array<Record<string, unknown>>>(cacheKey);
    if (cached) return cached;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    const perTenant = await mapWithConcurrency(tenants, 5, (t) =>
      this.tenantContext
        .runInTenantContext(t.id, (tx) =>
          tx.platformActivity.findMany({
            where: { tenantId: t.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        )
        .then((activities) => activities.map((a) => ({ ...a, tenantName: t.name }))),
    );

    const result = perTenant
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    await this.cache.set(cacheKey, result, ACTIVITY_CACHE_TTL_SECONDS);
    return result;
  }
}
