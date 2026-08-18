import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
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

@Injectable()
export class AdminPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada.');
  }

  async createForTenant(tenantId: string, dto: CreatePayoutDto) {
    await this.assertTenantExists(tenantId);
    const payout = await this.tenantContext.runInTenantContext(tenantId, (tx) =>
      tx.payout.create({
        data: {
          tenantId,
          period: dto.period,
          grossRevenueCents: dto.grossRevenueCents,
          feePct: dto.feePct,
          netCents: computeNetCents(dto.grossRevenueCents, dto.feePct),
          status: dto.status ?? 'pending',
        },
      }),
    );
    return serializePayout(payout);
  }

  async updateForTenant(tenantId: string, id: string, dto: UpdatePayoutDto) {
    await this.assertTenantExists(tenantId);
    const payout = await this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.payout.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Repasse não encontrado.');

      return tx.payout.update({ where: { id }, data: { status: dto.status } });
    });
    return serializePayout(payout);
  }

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    const perTenant = await Promise.all(
      tenants.map((t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) => tx.payout.findMany({ where: { tenantId: t.id } }))
          .then((payouts) => payouts.map((p) => ({ ...serializePayout(p), tenantName: t.name }))),
      ),
    );

    const items = perTenant.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }
}
