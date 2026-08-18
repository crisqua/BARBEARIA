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
          const [barbers, appointments] = await Promise.all([
            tx.user.count({ where: { role: 'barbeiro', active: true } }),
            tx.appointment.count({ where: { startsAt: { gte: monthStart, lt: monthEnd } } }),
          ]);
          return { barbers, appointments };
        }),
      ),
    );

    return {
      tenants: { total: totalTenants, active: activeTenants, suspended: suspendedTenants },
      barbersActive: perTenant.reduce((sum, t) => sum + t.barbers, 0),
      appointmentsThisMonth: perTenant.reduce((sum, t) => sum + t.appointments, 0),
    };
  }
}
