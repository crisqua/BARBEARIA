import { Injectable } from '@nestjs/common';
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
   */
  async list(limit: number) {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    const perTenant = await Promise.all(
      tenants.map((t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) =>
            tx.platformActivity.findMany({
              where: { tenantId: t.id },
              orderBy: { createdAt: 'desc' },
              take: limit,
            }),
          )
          .then((activities) => activities.map((a) => ({ ...a, tenantName: t.name }))),
      ),
    );

    return perTenant
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
