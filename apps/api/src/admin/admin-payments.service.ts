import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada.');
  }

  async createForTenant(tenantId: string, dto: CreatePaymentDto) {
    await this.assertTenantExists(tenantId);
    return this.tenantContext.runInTenantContext(tenantId, (tx) =>
      tx.payment.create({
        data: {
          tenantId,
          subscriptionId: dto.subscriptionId,
          amountCents: dto.amountCents,
          period: dto.period,
          status: dto.status ?? 'pending',
          paidAt: dto.status === 'paid' ? new Date() : undefined,
        },
      }),
    );
  }

  async updateForTenant(tenantId: string, id: string, dto: UpdatePaymentDto) {
    await this.assertTenantExists(tenantId);
    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.payment.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Pagamento não encontrado.');

      return tx.payment.update({
        where: { id },
        data: {
          status: dto.status,
          paidAt: dto.status === 'paid' ? (existing.paidAt ?? new Date()) : existing.paidAt,
        },
      });
    });
  }

  /** RLS normal (Sprint 6, mesma decisão de Subscription) — soma por tenant, sem bypass novo. */
  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    const perTenant = await Promise.all(
      tenants.map((t) =>
        this.tenantContext
          .runInTenantContext(t.id, (tx) => tx.payment.findMany({ where: { tenantId: t.id } }))
          .then((payments) => payments.map((p) => ({ ...p, tenantName: t.name }))),
      ),
    );

    const items = perTenant.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }
}
