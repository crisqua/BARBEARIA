import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { nowInBarbershopTime } from '../common/time.util';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@Injectable()
export class AppointmentsService {
  async create(tx: TenantTx, tenantId: string, clientId: string, dto: CreateAppointmentDto) {
    const service = await tx.service.findFirst({ where: { id: dto.serviceId, active: true } });
    if (!service) throw new NotFoundException('Serviço não encontrado ou inativo.');

    const professional = await tx.user.findFirst({
      where: { id: dto.professionalId, role: 'barbeiro' },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado.');

    const link = await tx.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId: dto.professionalId, serviceId: dto.serviceId } },
    });
    if (!link) throw new BadRequestException('Esse profissional não realiza esse serviço.');

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('startsAt inválido.');
    if (startsAt.getTime() < nowInBarbershopTime().getTime()) {
      throw new BadRequestException('Não é possível agendar em um horário no passado.');
    }

    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    await this.assertWithinWorkingHours(tx, dto.professionalId, startsAt, endsAt);

    try {
      return await tx.appointment.create({
        data: {
          tenantId,
          clientId,
          professionalId: dto.professionalId,
          serviceId: dto.serviceId,
          startsAt,
          endsAt,
          status: 'scheduled',
        },
      });
    } catch (err) {
      throw this.translateConflict(err);
    }
  }

  async list(tx: TenantTx, requester: AuthenticatedUser, query: ListAppointmentsQueryDto) {
    const where: Prisma.AppointmentWhereInput = {};

    if (requester.role === 'cliente') {
      where.clientId = requester.id;
    } else if (requester.role === 'barbeiro') {
      where.professionalId = requester.id;
    } else if (query.professionalId) {
      where.professionalId = query.professionalId;
    }

    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      tx.appointment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startsAt: 'desc' },
      }),
      tx.appointment.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(tx: TenantTx, id: string, requester: AuthenticatedUser) {
    return this.loadOwned(tx, id, requester);
  }

  async cancel(tx: TenantTx, id: string, requester: AuthenticatedUser) {
    const appointment = await this.loadOwned(tx, id, requester);
    if (appointment.status !== 'scheduled') {
      throw new BadRequestException('Só é possível cancelar agendamentos com status "scheduled".');
    }
    return tx.appointment.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async reschedule(tx: TenantTx, id: string, requester: AuthenticatedUser, dto: RescheduleAppointmentDto) {
    const appointment = await this.loadOwned(tx, id, requester);
    if (appointment.status !== 'scheduled') {
      throw new BadRequestException('Só é possível remarcar agendamentos com status "scheduled".');
    }

    const service = await tx.service.findUniqueOrThrow({ where: { id: appointment.serviceId } });

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('startsAt inválido.');
    if (startsAt.getTime() < nowInBarbershopTime().getTime()) {
      throw new BadRequestException('Não é possível remarcar para um horário no passado.');
    }

    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    await this.assertWithinWorkingHours(tx, appointment.professionalId, startsAt, endsAt);

    try {
      return await tx.appointment.update({ where: { id }, data: { startsAt, endsAt } });
    } catch (err) {
      throw this.translateConflict(err);
    }
  }

  /** cliente só vê/mexe nas próprias; barbeiro só vê a própria agenda; admin vê tudo do tenant. */
  private async loadOwned(tx: TenantTx, id: string, requester: AuthenticatedUser) {
    const appointment = await tx.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException();

    if (requester.role === 'cliente' && appointment.clientId !== requester.id) {
      throw new NotFoundException();
    }
    if (requester.role === 'barbeiro' && appointment.professionalId !== requester.id) {
      throw new NotFoundException();
    }

    return appointment;
  }

  /**
   * Sem conceito de timezone no schema — trata a hora armazenada como a hora
   * local da barbearia (sem conversão), simplificação de MVP documentada no
   * planejamento da Sprint 5. Extraído sempre via getters UTC, consistente com
   * common/time.util.ts.
   */
  private async assertWithinWorkingHours(
    tx: TenantTx,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    if (
      startsAt.getUTCFullYear() !== endsAt.getUTCFullYear() ||
      startsAt.getUTCMonth() !== endsAt.getUTCMonth() ||
      startsAt.getUTCDate() !== endsAt.getUTCDate()
    ) {
      throw new BadRequestException('O atendimento não pode atravessar a meia-noite.');
    }

    const weekday = startsAt.getUTCDay();
    const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
    const endMinutes = endsAt.getUTCHours() * 60 + endsAt.getUTCMinutes();

    const blocks = await tx.workingHour.findMany({ where: { professionalId, weekday } });
    const fits = blocks.some((block) => {
      const blockStart = block.startTime.getUTCHours() * 60 + block.startTime.getUTCMinutes();
      const blockEnd = block.endTime.getUTCHours() * 60 + block.endTime.getUTCMinutes();
      return startMinutes >= blockStart && endMinutes <= blockEnd;
    });

    if (!fits) {
      throw new BadRequestException('Horário fora do expediente do profissional.');
    }
  }

  private translateConflict(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException('Esse horário acabou de ser ocupado. Escolha outro.');
    }
    return err as Error;
  }
}
