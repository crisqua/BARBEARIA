import { computePaymentStatus } from '../../src/admin/admin-payment-status.service';

const d = (iso: string) => new Date(iso);

describe('computePaymentStatus (regra de calendário, sem banco)', () => {
  it('não marca atraso antes do primeiro ciclo — nasceu depois do dia de vencimento neste mês', () => {
    // nasce 25/01, vencimento dia 10 → primeiro ciclo só em 10/02. "Hoje" ainda em janeiro.
    const status = computePaymentStatus(d('2026-01-25T12:00:00Z'), 10, d('2026-01-30T12:00:00Z'), false);
    expect(status).toBe('em_dia');
  });

  it('não marca atraso antes do primeiro ciclo — nasceu depois do dia de vencimento, mesmo em meses seguintes se ainda não chegou o 1º ciclo', () => {
    // mesmo exemplo, mas "hoje" é 05/02 — ainda antes do 1º vencimento (10/02).
    const status = computePaymentStatus(d('2026-01-25T12:00:00Z'), 10, d('2026-02-05T12:00:00Z'), false);
    expect(status).toBe('em_dia');
  });

  it('marca atraso no primeiro ciclo quando o dia de vencimento chega sem pagamento', () => {
    // mesmo tenant, "hoje" é 10/02 (o próprio dia de vencimento) ou depois, sem pagamento.
    const status = computePaymentStatus(d('2026-01-25T12:00:00Z'), 10, d('2026-02-10T12:00:00Z'), false);
    expect(status).toBe('em_atraso');
  });

  it('nasceu no mesmo dia ou antes do vencimento → primeiro ciclo é no mês da criação', () => {
    // nasce 05/01, vencimento dia 10 → primeiro ciclo é 10/01 (não pula pro mês seguinte).
    const antesDoVencimento = computePaymentStatus(d('2026-01-05T12:00:00Z'), 10, d('2026-01-08T12:00:00Z'), false);
    expect(antesDoVencimento).toBe('em_dia');

    const depoisDoVencimento = computePaymentStatus(d('2026-01-05T12:00:00Z'), 10, d('2026-01-15T12:00:00Z'), false);
    expect(depoisDoVencimento).toBe('em_atraso');
  });

  it('nasce no dia 30 com vencimento dia 1 → primeiro ciclo só no dia 1 do mês seguinte', () => {
    const emJaneiro = computePaymentStatus(d('2026-01-30T12:00:00Z'), 1, d('2026-01-31T12:00:00Z'), false);
    expect(emJaneiro).toBe('em_dia');

    const emFevereiro = computePaymentStatus(d('2026-01-30T12:00:00Z'), 1, d('2026-02-01T12:00:00Z'), false);
    expect(emFevereiro).toBe('em_atraso');
  });

  it('pagamento registrado no período corrente sempre marca em dia, mesmo com o vencimento já passado', () => {
    const status = computePaymentStatus(d('2025-06-01T12:00:00Z'), 5, d('2026-03-20T12:00:00Z'), true);
    expect(status).toBe('em_dia');
  });

  it('ajusta o dia de vencimento pro último dia do mês em fevereiro (vencimento dia 30)', () => {
    // 2026 não é bissexto → fevereiro tem 28 dias. Vencimento 30 vira dia 28.
    const noDia28 = computePaymentStatus(d('2025-01-01T12:00:00Z'), 30, d('2026-02-28T12:00:00Z'), false);
    expect(noDia28).toBe('em_atraso');

    const noDia27 = computePaymentStatus(d('2025-01-01T12:00:00Z'), 30, d('2026-02-27T12:00:00Z'), false);
    expect(noDia27).toBe('em_dia');
  });

  it('não marca atraso antes do dia de vencimento dentro do mês corrente (já no ciclo normal)', () => {
    const status = computePaymentStatus(d('2025-01-01T12:00:00Z'), 20, d('2026-03-05T12:00:00Z'), false);
    expect(status).toBe('em_dia');
  });
});
