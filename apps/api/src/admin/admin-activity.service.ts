import { Injectable } from '@nestjs/common';
import { mapWithConcurrency } from '../common/batch-map.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

@Injectable()
export class AdminActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * `platform_activities` tem RLS normal — mesmo padrão de soma por tenant
   * já usado em Dashboard/Subscriptions/Payments/Payouts (TenantContextService,
   * sem bypass de RLS novo). Cada tenant já traz só as últimas `limit` linhas
   * suas, o suficiente pra montar o merge final sem buscar todo o histórico.
   *
   * SEM cache aqui, de propósito (removido em 2026-09-23) — evento novo
   * precisa aparecer na hora (é literalmente "atividade recente"), e a
   * chave cacheada por `limit` complicaria invalidar direito. A query em si
   * já é leve (1 find por tenant, não 4 como o dashboard) — `mapWithConcurrency`
   * sozinho já é suficiente aqui.
   */
  async list(limit: number) {
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

    return perTenant
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
