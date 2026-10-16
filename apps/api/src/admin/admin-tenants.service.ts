import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword } from '../common/password.util';
import { nowInBarbershopTime } from '../common/time.util';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { tenantBrandingCacheKey } from '../tenants-public/tenant-branding-cache-key';
import { SUBSCRIPTIONS_CACHE_KEY } from './admin-subscriptions.service';
import { logActivity } from './activity-log.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Cria o tenant, o admin inicial E a assinatura na MESMA transação — se
   * qualquer etapa falhar, nada fica pra trás. `tenants`/`plans` não têm RLS;
   * para os INSERTs em `users` e `subscriptions` (RLS forçado) precisamos do
   * set_config manual aqui dentro, porque o tenant ainda não existia quando a
   * transação começou — TenantContextService não serve nesse caso específico
   * (ele assume um tenant_id já conhecido).
   *
   * Cria uma `subscription` junto (linha abaixo) — por isso também invalida
   * o cache de `AdminSubscriptionsService.list()`, senão a lista fica até 90s
   * sem mostrar a assinatura que acabou de nascer com o tenant.
   */
  async create(dto: CreateTenantDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');

    const passwordHash = await hashPassword(dto.admin.password);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: dto.slug,
            name: dto.name,
            primaryColor: dto.primaryColor,
            secondaryColor: dto.secondaryColor,
          },
        });

        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            role: 'admin',
            name: dto.admin.name,
            email: dto.admin.email,
            passwordHash,
          },
        });

        const subscription = await tx.subscription.create({
          data: { tenantId: tenant.id, planId: dto.planId },
        });

        await logActivity(tx, tenant.id, 'tenant_created', `Barbearia "${tenant.name}" criada (plano ${plan.name}).`);

        return { tenant, admin: { id: admin.id, email: admin.email }, subscription };
      });
      await this.cache.del(SUBSCRIPTIONS_CACHE_KEY);
      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Slug já em uso.');
      }
      throw err;
    }
  }

  /**
   * Paginação real no banco (skip/take + count separado) — nunca busca todas as barbearias pra
   * depois filtrar/paginar em memória no frontend. Busca por nome também vira filtro de query
   * (`contains`, case-insensitive), não um filtro client-side sobre a página já carregada, senão
   * uma barbearia fora da página atual nunca apareceria na busca.
   */
  async list(page: number, pageSize: number, name?: string) {
    const where = name ? { name: { contains: name, mode: 'insensitive' as const } } : undefined;

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException();
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const updated = await this.prisma.tenant.update({ where: { id }, data: dto });
    await this.cache.del(tenantBrandingCacheKey(updated.slug));

    if (dto.status && dto.status !== existing.status) {
      const action = dto.status === 'suspended' ? 'tenant_suspended' : 'tenant_reactivated';
      const label = dto.status === 'suspended' ? 'suspensa' : 'reativada';
      await this.tenantContext.runInTenantContext(id, (tx) =>
        logActivity(tx, id, action, `Barbearia "${updated.name}" ${label}.`),
      );
    }

    return updated;
  }

  /**
   * Stats de UMA barbearia, sob demanda — nasceu da Sprint 7 (admin-desenvolvain.md): o Dashboard
   * parou de somar isso de todas as barbearias juntas (custo cresce com o número de barbearias,
   * ver desempenho_barbearia.md), então quem precisa desse detalhe agora pede explicitamente, 1
   * tenant por vez. 1 `runInTenantContext` só — nada de loop cross-tenant aqui.
   */
  async getStats(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException();

    const now = nowInBarbershopTime();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const months = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      return { month, start, end };
    });

    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const [appointmentsThisMonth, professionalsActive, professionalsInactive, clientsCount, monthlyCounts] =
        await Promise.all([
          tx.appointment.count({ where: { startsAt: { gte: monthStart, lt: monthEnd } } }),
          tx.user.count({ where: { role: 'barbeiro', active: true } }),
          tx.user.count({ where: { role: 'barbeiro', active: false } }),
          tx.user.count({ where: { role: 'cliente' } }),
          Promise.all(months.map((m) => tx.appointment.count({ where: { startsAt: { gte: m.start, lt: m.end } } }))),
        ]);

      return {
        appointmentsThisMonth,
        professionalsActive,
        professionalsInactive,
        clientsCount,
        monthlyAppointments: months.map((m, i) => ({ month: m.month, count: monthlyCounts[i] })),
      };
    });
  }
}
