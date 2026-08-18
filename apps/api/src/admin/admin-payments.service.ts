import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { formatCentsBRL, logActivity } from './activity-log.util';
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
    return tenant;
  }

  async createForTenant(tenantId: string, dto: CreatePaymentDto) {
    const tenant = await this.assertTenantExists(tenantId);
    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          subscriptionId: dto.subscriptionId,
          amountCents: dto.amountCents,
          period: dto.period,
          status: dto.status ?? 'pending',
          paidAt: dto.status === 'paid' ? new Date() : undefined,
        },
      });
      const action = payment.status === 'paid' ? 'payment_paid' : 'payment_registered';
      const valor = formatCentsBRL(payment.amountCents);
      await logActivity(tx, tenantId, action, `Pagamento de R$ ${valor} (${payment.period}) registrado para "${tenant.name}".`);
      return payment;
    });
  }

  async updateForTenant(tenantId: string, id: string, dto: UpdatePaymentDto) {
    const tenant = await this.assertTenantExists(tenantId);
    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const existing = await tx.payment.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Pagamento não encontrado.');

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: dto.status,
          paidAt: dto.status === 'paid' ? (existing.paidAt ?? new Date()) : existing.paidAt,
        },
      });

      if (dto.status === 'paid' && existing.status !== 'paid') {
        const valor = formatCentsBRL(updated.amountCents);
        await logActivity(tx, tenantId, 'payment_paid', `Pagamento de R$ ${valor} (${updated.period}) confirmado para "${tenant.name}".`);
      }

      return updated;
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
