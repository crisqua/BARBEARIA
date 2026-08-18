import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * `subscriptions` tem RLS normal (Sprint 5, decisão revista em relação ao
   * plano original) — mesma soma por tenant já usada no Dashboard/Usuários,
   * sem bypass de RLS novo. Paginação obrigatória (seção 8 do CLAUDE.md) —
   * mesmo padrão em memória de AdminUsersService, já que não dá pra paginar
   * no banco uma leitura que já é feita por tenant.
   */
  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: 'desc' },
    });

    const perTenant = await Promise.all(
      tenants.map((t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) =>
            tx.subscription.findUnique({ where: { tenantId: t.id }, include: { plan: true } }),
          )
          .then((subscription) => ({ tenant: t, subscription })),
      ),
    );

    const total = perTenant.length;
    const start = (page - 1) * pageSize;

    return { items: perTenant.slice(start, start + pageSize), total, page, pageSize };
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada.');
    return tenant;
  }

  async findForTenant(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const subscription = await this.tenantContext.runInTenantContext(tenantId, (tx) =>
      tx.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    );
    if (!subscription) throw new NotFoundException('Essa barbearia ainda não tem assinatura.');
    return subscription;
  }

  /** Upsert — tenants criados antes do Sprint 5 não têm assinatura ainda. */
  async upsertForTenant(tenantId: string, dto: UpdateSubscriptionDto) {
    await this.assertTenantExists(tenantId);

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado.');
    }

    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { tenantId } });

      if (!existing) {
        if (!dto.planId) {
          throw new BadRequestException('Essa barbearia ainda não tem assinatura — informe planId pra criar uma.');
        }
        return tx.subscription.create({
          data: { tenantId, planId: dto.planId, status: dto.status ?? 'active' },
          include: { plan: true },
        });
      }

      return tx.subscription.update({
        where: { tenantId },
        data: { planId: dto.planId, status: dto.status },
        include: { plan: true },
      });
    });
  }
}
