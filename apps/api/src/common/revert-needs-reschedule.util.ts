import { TenantTx } from '../prisma/tenant-context.service';
import { nowInBarbershopTime } from './time.util';

type RevertScope = { professionalId: string } | { serviceId: string };

/**
 * Reverte para "scheduled" os agendamentos futuros que estavam
 * `needs_reschedule` por causa do recurso (profissional ou serviço) que
 * acabou de ser reativado.
 *
 * Um único UPDATE, não um loop linha a linha — a checagem de conflito (não
 * sobrescrever um horário que outro agendamento ocupou nesse meio-tempo,
 * índice anti-double-booking da seção 5.3 do CLAUDE.md) vira um NOT EXISTS
 * dentro da própria instrução, resolvido pelo banco numa única viagem de
 * rede. A versão anterior fazia um UPDATE por agendamento dentro da mesma
 * transação, e com volume real (300+ agendamentos) estourava o timeout de
 * 5s do Prisma — a transação inteira desfazia, inclusive a reativação do
 * recurso, deixando o admin sem conseguir reativar (ver desempenho_barbearia.md).
 */
export async function revertNeedsReschedule(tx: TenantTx, scope: RevertScope): Promise<number> {
  const now = nowInBarbershopTime();

  if ('professionalId' in scope) {
    return tx.$executeRaw`
      UPDATE appointments a SET status = 'scheduled'
      WHERE a.professional_id = ${scope.professionalId}::uuid
        AND a.status = 'needs_reschedule'
        AND a.starts_at >= ${now}
        AND NOT EXISTS (
          SELECT 1 FROM appointments b
          WHERE b.tenant_id = a.tenant_id
            AND b.professional_id = a.professional_id
            AND b.starts_at = a.starts_at
            AND b.status = 'scheduled'
            AND b.id <> a.id
        )
    `;
  }

  return tx.$executeRaw`
    UPDATE appointments a SET status = 'scheduled'
    WHERE a.service_id = ${scope.serviceId}::uuid
      AND a.status = 'needs_reschedule'
      AND a.starts_at >= ${now}
      AND NOT EXISTS (
        SELECT 1 FROM appointments b
        WHERE b.tenant_id = a.tenant_id
          AND b.professional_id = a.professional_id
          AND b.starts_at = a.starts_at
          AND b.status = 'scheduled'
          AND b.id <> a.id
      )
  `;
}
