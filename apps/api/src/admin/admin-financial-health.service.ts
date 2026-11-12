import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService, TenantTx } from '../prisma/tenant-context.service';
import { FinancialHealthQueryDto } from './dto/financial-health-query.dto';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BUCKETS = 7;

interface Bucket {
  index: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

const toDateOnly = (iso: string) => iso.slice(0, 10);

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const diffDays = (fromDateStr: string, toDateStr: string): number =>
  Math.round(
    (new Date(`${toDateStr}T00:00:00.000Z`).getTime() - new Date(`${fromDateStr}T00:00:00.000Z`).getTime()) /
      ONE_DAY_MS,
  ) + 1;

/**
 * Divide [from, to] em até MAX_BUCKETS baldes de tamanho igual (mesma regra
 * que o gráfico "Receita x Despesas" do Financeiro de cada barbearia já usa
 * no cliente — aqui decidida no backend, já que a query vai agregar por
 * balde direto no banco).
 */
function buildBuckets(fromIso: string, toIso: string): Bucket[] {
  const fromDate = toDateOnly(fromIso);
  const toDate = toDateOnly(toIso);
  const totalDays = diffDays(fromDate, toDate);
  const bucketCount = Math.min(MAX_BUCKETS, totalDays);
  const bucketLen = totalDays / bucketCount;

  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const startIdx = Math.floor(i * bucketLen);
    const endIdx = i === bucketCount - 1 ? totalDays - 1 : Math.floor((i + 1) * bucketLen) - 1;
    buckets.push({
      index: i + 1,
      startDate: addDays(fromDate, startIdx),
      endDate: addDays(fromDate, endIdx),
    });
  }
  return buckets;
}

type ReceitaRow = { bucket_index: number; receita_cents: number; atendimentos: number };
type DespesasRow = { bucket_index: number; despesas_cents: number };
type ReceitaTotalRow = { receita_cents: number; atendimentos: number };
type DespesasTotalRow = { despesas_cents: number };

@Injectable()
export class AdminFinancialHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada.');
    return tenant;
  }

  /**
   * Receita/despesas/atendimentos de UMA barbearia, agregados por balde no
   * banco (nunca busca a lista crua de agendamentos/despesas pro Node somar)
   * — exigência explícita: as queries aplicam o filtro de período e já
   * devolvem os totais prontos. RLS (via runInTenantContext) garante que as
   * agregações nunca cruzam com outro tenant, mesmo sendo SQL raw.
   */
  async getFinancialHealth(tenantId: string, query: FinancialHealthQueryDto) {
    await this.assertTenantExists(tenantId);

    const buckets = buildBuckets(query.from, query.to);
    const rangeStart = buckets[0].startDate;
    const rangeEnd = buckets[buckets.length - 1].endDate;
    const totalDays = diffDays(rangeStart, rangeEnd);

    const prevEnd = addDays(rangeStart, -1);
    const prevStart = addDays(prevEnd, -(totalDays - 1));

    return this.tenantContext.runInTenantContext(tenantId, async (tx) => {
      const [receitaRows, despesasRows, receitaPrevRows, despesasPrevRows] = await Promise.all([
        this.queryReceitaPorBalde(tx, buckets),
        this.queryDespesasPorBalde(tx, buckets),
        this.queryReceitaTotal(tx, prevStart, prevEnd),
        this.queryDespesasTotal(tx, prevStart, prevEnd),
      ]);

      const despesasByBucket = new Map(despesasRows.map((r) => [r.bucket_index, r.despesas_cents]));

      const bucketResults = buckets.map((b) => {
        const receita = receitaRows.find((r) => r.bucket_index === b.index);
        return {
          from: b.startDate,
          to: b.endDate,
          receitaCents: receita?.receita_cents ?? 0,
          despesasCents: despesasByBucket.get(b.index) ?? 0,
          atendimentos: receita?.atendimentos ?? 0,
        };
      });

      const totals = bucketResults.reduce(
        (acc, b) => ({
          receitaCents: acc.receitaCents + b.receitaCents,
          despesasCents: acc.despesasCents + b.despesasCents,
          atendimentos: acc.atendimentos + b.atendimentos,
        }),
        { receitaCents: 0, despesasCents: 0, atendimentos: 0 },
      );

      const receitaPrev = receitaPrevRows[0] ?? { receita_cents: 0, atendimentos: 0 };
      const despesasPrev = despesasPrevRows[0] ?? { despesas_cents: 0 };

      return {
        range: { from: rangeStart, to: rangeEnd },
        totals,
        previous: {
          range: { from: prevStart, to: prevEnd },
          receitaCents: receitaPrev.receita_cents,
          despesasCents: despesasPrev.despesas_cents,
          atendimentos: receitaPrev.atendimentos,
        },
        buckets: bucketResults,
      };
    });
  }

  private bucketValuesSql(buckets: Bucket[]) {
    return Prisma.join(
      buckets.map((b) => Prisma.sql`(${b.index}, ${b.startDate}::date, ${b.endDate}::date)`),
      ', ',
    );
  }

  private queryReceitaPorBalde(tx: TenantTx, buckets: Bucket[]) {
    return tx.$queryRaw<ReceitaRow[]>(Prisma.sql`
      WITH buckets(bucket_index, b_start, b_end) AS (VALUES ${this.bucketValuesSql(buckets)})
      SELECT b.bucket_index::int AS bucket_index,
             COALESCE(SUM(sv.price_cents), 0)::int AS receita_cents,
             COUNT(a.id)::int AS atendimentos
      FROM buckets b
      LEFT JOIN appointments a
        ON a.status = 'completed' AND a.starts_at >= b.b_start AND a.starts_at < (b.b_end + 1)
      LEFT JOIN services sv ON sv.id = a.service_id
      GROUP BY b.bucket_index
      ORDER BY b.bucket_index
    `);
  }

  private queryDespesasPorBalde(tx: TenantTx, buckets: Bucket[]) {
    return tx.$queryRaw<DespesasRow[]>(Prisma.sql`
      WITH buckets(bucket_index, b_start, b_end) AS (VALUES ${this.bucketValuesSql(buckets)})
      SELECT b.bucket_index::int AS bucket_index,
             COALESCE(SUM(e.amount_cents), 0)::int AS despesas_cents
      FROM buckets b
      LEFT JOIN expenses e ON e.expense_date >= b.b_start AND e.expense_date <= b.b_end
      GROUP BY b.bucket_index
      ORDER BY b.bucket_index
    `);
  }

  private queryReceitaTotal(tx: TenantTx, start: string, end: string) {
    return tx.$queryRaw<ReceitaTotalRow[]>(Prisma.sql`
      SELECT COALESCE(SUM(sv.price_cents), 0)::int AS receita_cents, COUNT(a.id)::int AS atendimentos
      FROM appointments a
      JOIN services sv ON sv.id = a.service_id
      WHERE a.status = 'completed' AND a.starts_at >= ${start}::date AND a.starts_at < (${end}::date + 1)
    `);
  }

  private queryDespesasTotal(tx: TenantTx, start: string, end: string) {
    return tx.$queryRaw<DespesasTotalRow[]>(Prisma.sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS despesas_cents
      FROM expenses
      WHERE expense_date >= ${start}::date AND expense_date <= ${end}::date
    `);
  }
}
