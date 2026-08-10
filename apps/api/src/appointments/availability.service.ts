import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantTx } from '../prisma/tenant-context.service';

export interface AvailabilityResult {
  date: string;
  professionalId: string;
  serviceId: string;
  slots: string[];
}

@Injectable()
export class AvailabilityService {
  async getAvailableSlots(
    tx: TenantTx,
    professionalId: string,
    serviceId: string,
    date: string,
  ): Promise<AvailabilityResult> {
    const professional = await tx.user.findFirst({ where: { id: professionalId, role: 'barbeiro' } });
    if (!professional) throw new NotFoundException('Profissional não encontrado.');

    const service = await tx.service.findFirst({ where: { id: serviceId, active: true } });
    if (!service) throw new NotFoundException('Serviço não encontrado ou inativo.');

    const link = await tx.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    });
    if (!link) throw new BadRequestException('Esse profissional não realiza esse serviço.');

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException('date inválida (use YYYY-MM-DD).');
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    const weekday = dayStart.getUTCDay();

    const [blocks, existing] = await Promise.all([
      tx.workingHour.findMany({ where: { professionalId, weekday } }),
      tx.appointment.findMany({
        where: { professionalId, status: 'scheduled', startsAt: { gte: dayStart, lt: dayEnd } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const durationMs = service.durationMinutes * 60_000;
    const now = Date.now();
    const slots: string[] = [];

    for (const block of blocks) {
      const blockStartMinutes = block.startTime.getUTCHours() * 60 + block.startTime.getUTCMinutes();
      const blockEndMinutes = block.endTime.getUTCHours() * 60 + block.endTime.getUTCMinutes();

      for (
        let minutes = blockStartMinutes;
        minutes + service.durationMinutes <= blockEndMinutes;
        minutes += service.durationMinutes
      ) {
        const slotStart = new Date(dayStart.getTime() + minutes * 60_000);
        if (slotStart.getTime() < now) continue;

        const slotEnd = new Date(slotStart.getTime() + durationMs);
        const overlaps = existing.some((appt) => slotStart < appt.endsAt && slotEnd > appt.startsAt);
        if (!overlaps) {
          slots.push(slotStart.toISOString());
        }
      }
    }

    return { date, professionalId, serviceId, slots };
  }
}
