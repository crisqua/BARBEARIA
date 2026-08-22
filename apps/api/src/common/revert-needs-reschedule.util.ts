import { Prisma } from '@prisma/client';
import { TenantTx } from '../prisma/tenant-context.service';
import { nowInBarbershopTime } from './time.util';

/**
 * Reverte para "scheduled" os agendamentos futuros que estavam
 * `needs_reschedule` por causa do recurso (profissional ou serviço) que
 * acabou de ser reativado. Linha a linha, não `updateMany` — o índice
 * anti-double-booking (tenant_id, professional_id, starts_at) só vale pra
 * status='scheduled' (seção 5.3 do CLAUDE.md), e o horário que ficou órfão
 * pode ter sido preenchido por outro agendamento nesse meio-tempo. Nesse
 * caso o reverso não deve acontecer — mantém `needs_reschedule`, cliente
 * ainda precisa ser contatado.
 */
export async function revertNeedsReschedule(
  tx: TenantTx,
  where: Prisma.AppointmentWhereInput,
): Promise<number> {
  const candidates = await tx.appointment.findMany({
    where: { ...where, status: 'needs_reschedule', startsAt: { gte: nowInBarbershopTime() } },
    select: { id: true },
  });

  let revertedCount = 0;
  for (const { id } of candidates) {
    try {
      await tx.appointment.update({ where: { id }, data: { status: 'scheduled' } });
      revertedCount++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
  }
  return revertedCount;
}
