import { Injectable } from '@nestjs/common';
import { TenantTx } from '../prisma/tenant-context.service';
import { SummaryQueryDto } from './dto/summary-query.dto';

@Injectable()
export class FinanceiroService {
  /**
   * Receita não tem tabela própria (Sprint 28, admin-desenvolvain.md) — vem de
   * agregação sobre appointments concluídos (status = 'completed', não
   * 'scheduled'/projetado, decisão do usuário 11/11/2026) + services.price_cents.
   */
  async summary(tx: TenantTx, query: SummaryQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const completedAppointments = await tx.appointment.findMany({
      where: { status: 'completed', startsAt: { gte: from, lte: to } },
      select: { service: { select: { priceCents: true } } },
    });

    const receitaCents = completedAppointments.reduce((sum, a) => sum + a.service.priceCents, 0);
    const ticketMedioCents = completedAppointments.length > 0
      ? Math.round(receitaCents / completedAppointments.length)
      : 0;

    const expensesByCategory = await tx.expense.groupBy({
      by: ['category'],
      where: { expenseDate: { gte: from, lte: to } },
      _sum: { amountCents: true },
    });

    const despesasCents = expensesByCategory.reduce((sum, row) => sum + (row._sum.amountCents ?? 0), 0);

    return {
      receitaCents,
      despesasCents,
      saldoCents: receitaCents - despesasCents,
      ticketMedioCents,
      despesasPorCategoria: expensesByCategory.map((row) => ({
        category: row.category,
        totalCents: row._sum.amountCents ?? 0,
      })),
    };
  }
}
