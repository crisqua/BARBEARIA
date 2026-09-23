import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { CacheService } from '../cache/cache.service';
import { mapWithConcurrency } from '../common/batch-map.util';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { logActivity } from './activity-log.util';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const SUBSCRIPTIONS_CACHE_KEY = 'admin:subscriptions:all';
const SUBSCRIPTIONS_CACHE_TTL_SECONDS = 90;

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: CacheService,
  ) {}

  /**
   * `subscriptions` tem RLS normal (Sprint 5, decisão revista em relação ao
   * plano original) — mesma soma por tenant já usada no Dashboard/Usuários,
   * sem bypass de RLS novo. Paginação obrigatória (seção 8 do CLAUDE.md) —
   * mesmo padrão em memória de AdminUsersService, já que não dá pra paginar
   * no banco uma leitura que já é feita por tenant.
   *
   * Cache de 90s no resultado cheio (antes da paginação) — sem isso, cada
   * página pedida (1, 2, 3...) refaz a busca em todos os tenants do zero pra
   * mostrar só um pedaço diferente do mesmo resultado.
   */
  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let perTenant = await this.cache.get<Array<{ tenant: { id: string; name: string; slug: string }; subscription: unknown }>>(
      SUBSCRIPTIONS_CACHE_KEY,
    );

    if (!perTenant) {
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { createdAt: 'desc' },
      });

      perTenant = await mapWithConcurrency(tenants, 5, (t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) =>
            tx.subscription.findUnique({ where: { tenantId: t.id }, include: { plan: true } }),
          )
          .then((subscription) => ({ tenant: t, subscription })),
      );

      await this.cache.set(SUBSCRIPTIONS_CACHE_KEY, perTenant, SUBSCRIPTIONS_CACHE_TTL_SECONDS);
    }

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
    const tenant = await this.assertTenantExists(tenantId);

    let newPlan: { name: string } | null = null;
    if (dto.planId) {
      newPlan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!newPlan) throw new NotFoundException('Plano não encontrado.');
    }

    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { tenantId }, include: { plan: true } });

      if (!existing) {
        if (!dto.planId) {
          throw new BadRequestException('Essa barbearia ainda não tem assinatura — informe planId pra criar uma.');
        }
        const created = await tx.subscription.create({
          data: { tenantId, planId: dto.planId, status: dto.status ?? 'active' },
          include: { plan: true },
        });
        await logActivity(
          tx,
          tenantId,
          'subscription_created',
          `Assinatura criada para "${tenant.name}" (plano ${created.plan.name}).`,
        );
        return created;
      }

      const updated = await tx.subscription.update({
        where: { tenantId },
        data: { planId: dto.planId, status: dto.status },
        include: { plan: true },
      });

      if (dto.planId && dto.planId !== existing.planId) {
        await logActivity(
          tx,
          tenantId,
          'plan_changed',
          `"${tenant.name}" trocou de plano: ${existing.plan.name} → ${updated.plan.name}.`,
        );
      }

      return updated;
    });
  }
}
