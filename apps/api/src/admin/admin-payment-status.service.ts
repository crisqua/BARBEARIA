import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { mapWithConcurrency } from '../common/batch-map.util';
import { nowInBarbershopTime } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

export const PAYMENT_STATUS_CACHE_KEY = 'admin:payment-status:all';
const PAYMENT_STATUS_CACHE_TTL_SECONDS = 90;

export type PaymentStatus = 'em_dia' | 'em_atraso' | 'sem_cobranca';

type PerTenantPaymentStatus = { tenantId: string; status: PaymentStatus };

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function currentPeriod(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Status de cobrança de UMA barbearia pro mês corrente — função pura (sem
 * banco), pra poder testar a regra de calendário isolada.
 *
 * Regra (confirmada com o usuário, revisão 2026-11-12, mesmo dia da criação
 * desta Sprint 30): o primeiro vencimento possível é o dia de pagamento no
 * mês em que a barbearia nasceu, OU no mês seguinte se ela nasceu depois
 * desse dia naquele mês — nunca marca "em atraso" antes do primeiro ciclo
 * completo (ex: nasce dia 25 com vencimento 10 → só cobra a partir do dia 10
 * do mês seguinte; nasce dia 30 com vencimento 1 → só cobra a partir do dia 1
 * do mês seguinte). A partir do primeiro ciclo, cada mês compara o dia de
 * hoje com o dia de vencimento daquele mês (ajustado pro último dia do mês
 * em meses com menos de 30/31 dias, ex: fevereiro) contra um Payment pago com
 * period = mês corrente — sem memória de meses anteriores (decisão
 * consciente: só o período atual importa).
 */
export function computePaymentStatus(
  createdAt: Date,
  paymentDueDay: number,
  now: Date,
  hasPaidThisPeriod: boolean,
): 'em_dia' | 'em_atraso' {
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

  const creationDay = createdAt.getUTCDate();
  let firstDueYear = createdAt.getUTCFullYear();
  let firstDueMonth = createdAt.getUTCMonth();
  if (creationDay > paymentDueDay) {
    firstDueMonth += 1;
    if (firstDueMonth > 11) {
      firstDueMonth = 0;
      firstDueYear += 1;
    }
  }

  const beforeFirstCycle = nowYear < firstDueYear || (nowYear === firstDueYear && nowMonth < firstDueMonth);
  if (beforeFirstCycle) return 'em_dia';

  const dueDayThisMonth = Math.min(paymentDueDay, daysInMonth(nowYear, nowMonth));
  const pastDueDate = nowDay >= dueDayThisMonth;

  if (!pastDueDate || hasPaidThisPeriod) return 'em_dia';
  return 'em_atraso';
}

/**
 * Status de cobrança cross-tenant — mesmo padrão de `AdminSubscriptionsService`
 * (mapWithConcurrency + cache de 90s): evitar o incidente já documentado
 * (`P2028`, `common/batch-map.util.ts`) de abrir 1 transação por tenant sem
 * limite de concorrência. Dashboard e lista de Barbearias leem o MESMO cache,
 * nunca cada um faz seu próprio loop cross-tenant.
 */
@Injectable()
export class AdminPaymentStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: CacheService,
  ) {}

  private async getPerTenantStatus(): Promise<PerTenantPaymentStatus[]> {
    const cached = await this.cache.get<PerTenantPaymentStatus[]>(PAYMENT_STATUS_CACHE_KEY);
    if (cached) return cached;

    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, createdAt: true, paymentDueDay: true },
    });

    const now = nowInBarbershopTime();
    const period = currentPeriod(now);

    const perTenant = await mapWithConcurrency(tenants, 5, async (t) => {
      const status = await this.tenantContext.runInTenantContext(t.id, async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: { tenantId: t.id },
          include: { plan: true },
        });

        if (!subscription || subscription.status !== 'active' || subscription.plan.code === 'trial') {
          return 'sem_cobranca' as const;
        }

        const paidPayment = await tx.payment.findFirst({
          where: { tenantId: t.id, period, status: 'paid' },
        });

        return computePaymentStatus(t.createdAt, t.paymentDueDay, now, !!paidPayment);
      });

      return { tenantId: t.id, status };
    });

    await this.cache.set(PAYMENT_STATUS_CACHE_KEY, perTenant, PAYMENT_STATUS_CACHE_TTL_SECONDS);
    return perTenant;
  }

  async getOverview() {
    const perTenant = await this.getPerTenantStatus();
    const counts = { emDia: 0, emAtraso: 0, semCobranca: 0 };
    for (const t of perTenant) {
      if (t.status === 'em_dia') counts.emDia += 1;
      else if (t.status === 'em_atraso') counts.emAtraso += 1;
      else counts.semCobranca += 1;
    }
    return counts;
  }

  async getStatusByTenantIds(tenantIds: string[]): Promise<Map<string, PaymentStatus>> {
    const perTenant = await this.getPerTenantStatus();
    const byId = new Map(perTenant.map((t) => [t.tenantId, t.status]));
    const result = new Map<string, PaymentStatus>();
    for (const id of tenantIds) {
      const status = byId.get(id);
      if (status) result.set(id, status);
    }
    return result;
  }

  async invalidateCache() {
    await this.cache.del(PAYMENT_STATUS_CACHE_KEY);
  }
}
