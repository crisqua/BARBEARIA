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

  /**
   * Pagamentos de UMA barbearia, sob demanda — mesmo padrão de `AdminTenantsService.getStats`
   * (Sprint 8, admin-desenvolvain.md): substitui o antigo `list()` cross-tenant (loop em todas
   * as barbearias + cache de 90s pra disfarçar o custo). 1 `runInTenantContext`, sem cache —
   * já rápido por consultar só 1 tenant.
   */
  async listForTenant(tenantId: string, query: PaginationQueryDto) {
    await this.assertTenantExists(tenantId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.payment.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.payment.count({ where: { tenantId } }),
      ]);

      return { items, total, page, pageSize };
    });
  }
}
