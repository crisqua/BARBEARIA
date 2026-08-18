import { Injectable } from '@nestjs/common';
import { nowInBarbershopTime } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * `tenants` não tem RLS (seção 5.4/6.4 do CLAUDE.md) — dá pra ler cross-tenant
   * direto. Mas `users` e `appointments` têm RLS FORÇADO, e a role de runtime
   * (`barberaria_app`) é NOBYPASSRLS de propósito (scripts/setup-app-role.ts) —
   * não existe leitura cross-tenant direta sem contexto de tenant nessas tabelas,
   * por design. Em vez de criar qualquer mecanismo de bypass novo, soma por
   * tenant usando o mesmo `TenantContextService` que todo o resto do sistema já
   * usa pra RLS.
   */
  async overview() {
    const now = nowInBarbershopTime();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [totalTenants, activeTenants, suspendedTenants, tenants] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'suspended' } }),
      this.prisma.tenant.findMany({ select: { id: true } }),
    ]);

    const perTenant = await Promise.all(
      tenants.map(({ id }) =>
        this.tenantContext.runInTenantContext(id, async (tx) => {
          const [barbers, appointments, subscription, pendingPayments] = await Promise.all([
            tx.user.count({ where: { role: 'barbeiro', active: true } }),
            tx.appointment.count({ where: { startsAt: { gte: monthStart, lt: monthEnd } } }),
            tx.subscription.findUnique({ where: { tenantId: id }, include: { plan: true } }),
            tx.payment.count({ where: { status: 'pending' } }),
          ]);
          return { barbers, appointments, subscription, pendingPayments };
        }),
      ),
    );

    const assinaturasAtivas = perTenant
      .map((t) => t.subscription)
      .filter((s): s is NonNullable<typeof s> => !!s && s.status === 'active');

    return {
      tenants: { total: totalTenants, active: activeTenants, suspended: suspendedTenants },
      barbersActive: perTenant.reduce((sum, t) => sum + t.barbers, 0),
      appointmentsThisMonth: perTenant.reduce((sum, t) => sum + t.appointments, 0),
      // Só soma — nenhuma regra de negócio nova (Sprint 6, ver admin-desenvolvain.md).
      mrrCents: assinaturasAtivas.reduce((sum, s) => sum + (s.plan.priceCents ?? 0), 0),
      trialsAtivos: assinaturasAtivas.filter((s) => s.plan.code === 'trial').length,
      pendingPayments: perTenant.reduce((sum, t) => sum + t.pendingPayments, 0),
    };
  }
}
