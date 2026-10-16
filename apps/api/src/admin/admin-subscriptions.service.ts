import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { CacheService } from '../cache/cache.service';
import { mapWithConcurrency } from '../common/batch-map.util';
import { logActivity } from './activity-log.util';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

export const SUBSCRIPTIONS_CACHE_KEY = 'admin:subscriptions:all';
const SUBSCRIPTIONS_CACHE_TTL_SECONDS = 90;

type PlanRow = { id: string; code: string; name: string; priceCents: number | null };
type SubscriptionRow = { status: string; plan: PlanRow } & Record<string, unknown>;
type PerTenantSubscription = {
  tenant: { id: string; name: string; slug: string };
  subscription: SubscriptionRow | null;
};

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Busca (ou lê do cache) a assinatura de cada barbearia — base compartilhada
   * por `list()` e `getOverview()` (Sprint 7), pra não bater duas vezes no
   * mesmo loop cross-tenant por causa de duas telas diferentes quererem o
   * mesmo dado. Mesmo cache de 90s de sempre.
   */
  private async getPerTenantSubscriptions(): Promise<PerTenantSubscription[]> {
    let perTenant = await this.cache.get<PerTenantSubscription[]>(SUBSCRIPTIONS_CACHE_KEY);

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
          .then((subscription) => ({ tenant: t, subscription: subscription as SubscriptionRow | null })),
      );

      await this.cache.set(SUBSCRIPTIONS_CACHE_KEY, perTenant, SUBSCRIPTIONS_CACHE_TTL_SECONDS);
    }

    return perTenant;
  }

  /**
   * MRR, trials ativos, distribuição de barbearias por plano e contagem por status —
   * usado pelo Dashboard (Sprint 7) e pela tela Assinaturas (Sprint 9, admin-desenvolvain.md),
   * que deixou de listar as barbearias uma a uma pra só pedir esse resumo. Lê o MESMO cache
   * que `list()` usava, nunca bate no banco de novo só por causa de quem está chamando.
   */
  async getOverview() {
    const perTenant = await this.getPerTenantSubscriptions();

    const active = perTenant.filter(
      (t): t is PerTenantSubscription & { subscription: SubscriptionRow } =>
        !!t.subscription && t.subscription.status === 'active',
    );

    const mrrCents = active.reduce((sum, t) => sum + (t.subscription.plan.priceCents ?? 0), 0);
    const trialsAtivos = active.filter((t) => t.subscription.plan.code === 'trial').length;

    const byPlan = new Map<string, { planCode: string; planName: string; count: number }>();
    for (const t of perTenant) {
      if (!t.subscription) continue;
      const { code, name } = t.subscription.plan;
      const entry = byPlan.get(code);
      if (entry) entry.count += 1;
      else byPlan.set(code, { planCode: code, planName: name, count: 1 });
    }

    const activeCount = active.length;
    const cancelledCount = perTenant.filter((t) => t.subscription?.status === 'cancelled').length;
    const noneCount = perTenant.filter((t) => !t.subscription).length;

    return {
      mrrCents,
      trialsAtivos,
      tenantsByPlan: Array.from(byPlan.values()),
      activeCount,
      cancelledCount,
      noneCount,
    };
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

  /**
   * Upsert — tenants criados antes do Sprint 5 não têm assinatura ainda.
   * Invalida o cache de `list()` depois de escrever — sem isso, a lista
   * ficaria até 90s mostrando a assinatura antiga (pego pelo teste e2e:
   * "cria a assinatura via PATCH... lista cross-tenant paginada inclui").
   */
  async upsertForTenant(tenantId: string, dto: UpdateSubscriptionDto) {
    const tenant = await this.assertTenantExists(tenantId);

    let newPlan: { name: string } | null = null;
    if (dto.planId) {
      newPlan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!newPlan) throw new NotFoundException('Plano não encontrado.');
    }

    const result = await this.tenantContext.runInTenantContext(tenantId, async (tx) => {
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

    await this.cache.del(SUBSCRIPTIONS_CACHE_KEY);
    return result;
  }
}
