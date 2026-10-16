import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSubscriptionsService } from './admin-subscriptions.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
  ) {}

  /**
   * Reescrito na Sprint 7 (admin-desenvolvain.md) — o overview antigo somava
   * profissionais/agendamentos/pagamentos pendentes de TODAS as barbearias,
   * abrindo uma transação por tenant (`TenantContextService`, já que `users`/
   * `appointments` têm RLS forçado e a role de runtime é NOBYPASSRLS de
   * propósito — não existe leitura cross-tenant direta nessas tabelas). Isso
   * crescia linearmente com o número de barbearias (ver desempenho_barbearia.md,
   * 14/10/2026: >2s com 55 barbearias). Decisão de produto, não só performance:
   * o Dashboard não precisa mais desses números agregados — quem precisa de
   * detalhe operacional de uma barbearia pede via `GET /v1/admin/tenants/:id/stats`
   * (admin-tenants.service.ts), sob demanda, 1 tenant por vez.
   *
   * `tenants` não tem RLS (seção 5.4/6.4 do CLAUDE.md) — as contagens abaixo são
   * leitura direta, sem transação nenhuma. MRR/trials/distribuição por plano
   * vêm do cache de 90s que `AdminSubscriptionsService` já mantém pra tela de
   * Assinaturas — nenhuma leitura nova ao banco só por causa do Dashboard.
   */
  async overview() {
    const [totalTenants, activeTenants, suspendedTenants, subscriptionsOverview] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'suspended' } }),
      this.adminSubscriptionsService.getOverview(),
    ]);

    return {
      tenants: { total: totalTenants, active: activeTenants, suspended: suspendedTenants },
      mrrCents: subscriptionsOverview.mrrCents,
      trialsAtivos: subscriptionsOverview.trialsAtivos,
      tenantsByPlan: subscriptionsOverview.tenantsByPlan,
    };
  }
}
