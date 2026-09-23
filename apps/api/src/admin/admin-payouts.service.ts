import { Injectable, NotFoundException } from '@nestjs/common';
import { mapWithConcurrency } from '../common/batch-map.util';
import { CacheService } from '../cache/cache.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { formatCentsBRL, logActivity } from './activity-log.util';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';

/** Só a conta — bruto menos taxa%, os dois digitados pelo Super Admin. Nenhuma
 * regra de negócio (taxa, base de cálculo) é decidida aqui. */
function computeNetCents(grossRevenueCents: number, feePct: number): number {
  return Math.round(grossRevenueCents * (1 - feePct / 100));
}

/** Prisma serializa Decimal como string — normaliza pra number, mesmo padrão
 * já usado em commissionPercentage (professionals.service.ts). */
function serializePayout<T extends { feePct: unknown }>(payout: T) {
  return { ...payout, feePct: Number(payout.feePct) };
}

const PAYOUTS_CACHE_KEY = 'admin:payouts:all';
const PAYOUTS_CACHE_TTL_SECONDS = 90;

@Injectable()
export class AdminPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: CacheService,
  ) {}

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada.');
    return tenant;
  }

  async createForTenant(tenantId: string, dto: CreatePayoutDto) {
    const tenant = await this.assertTenantExists(tenantId);
    const payout = await this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const created = await tx.payout.create({
        data: {
          tenantId,
          period: dto.period,
          grossRevenueCents: dto.grossRevenueCents,
          feePct: dto.feePct,
          netCents: computeNetCents(dto.grossRevenueCents, dto.feePct),
          status: dto.status ?? 'pending',
        },
      });
      const action = created.status === 'paid' ? 'payout_paid' : 'payout_registered';
      const valor = formatCentsBRL(created.netCents);
      await logActivity(tx, tenantId, action, `Repasse de R$ ${valor} (${created.period}) registrado para "${tenant.name}".`);
      return created;
    });
    return serializePayout(payout);
  }

  async updateForTenant(tenantId: string, id: string, dto: UpdatePayoutDto) {
    const tenant = await this.assertTenantExists(tenantId);
    const payout = await this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.payout.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Repasse não encontrado.');

      const updated = await tx.payout.update({ where: { id }, data: { status: dto.status } });

      if (dto.status === 'paid' && existing.status !== 'paid') {
        const valor = formatCentsBRL(updated.netCents);
        await logActivity(tx, tenantId, 'payout_paid', `Repasse de R$ ${valor} (${updated.period}) pago para "${tenant.name}".`);
      }

      return updated;
    });
    return serializePayout(payout);
  }

  /** Cache de 90s no resultado já ordenado (pré-paginação) — mesmo padrão de AdminPaymentsService. */
  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let items = await this.cache.get<Array<Record<string, unknown>>>(PAYOUTS_CACHE_KEY);

    if (!items) {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

      const perTenant = await mapWithConcurrency(tenants, 5, (t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) => tx.payout.findMany({ where: { tenantId: t.id } }))
          .then((payouts) => payouts.map((p) => ({ ...serializePayout(p), tenantName: t.name }))),
      );

      items = perTenant.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      await this.cache.set(PAYOUTS_CACHE_KEY, items, PAYOUTS_CACHE_TTL_SECONDS);
    }

    const total = items.length;
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }
}
