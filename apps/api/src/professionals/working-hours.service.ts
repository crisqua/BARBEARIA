import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatTimeString, parseTimeString } from '../common/time.util';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateWorkingHourDto } from './dto/create-working-hour.dto';
import { UpdateWorkingHourDto } from './dto/update-working-hour.dto';

interface WorkingHourRow {
  id: string;
  tenantId: string;
  professionalId: string;
  weekday: number;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class WorkingHoursService {
  async list(tx: TenantTx, professionalId: string) {
    const rows = await tx.workingHour.findMany({
      where: { professionalId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(tx: TenantTx, tenantId: string, professionalId: string, dto: CreateWorkingHourDto) {
    this.assertRange(dto.startTime, dto.endTime);

    try {
      const created = await tx.workingHour.create({
        data: {
          tenantId,
          professionalId,
          weekday: dto.weekday,
          startTime: parseTimeString(dto.startTime),
          endTime: parseTimeString(dto.endTime),
        },
      });
      return this.serialize(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new NotFoundException('Profissional não encontrado neste tenant.');
      }
      throw err;
    }
  }

  async update(tx: TenantTx, professionalId: string, id: string, dto: UpdateWorkingHourDto) {
    const existing = await tx.workingHour.findFirst({ where: { id, professionalId } });
    if (!existing) throw new NotFoundException();

    const startTime = dto.startTime ?? formatTimeString(existing.startTime);
    const endTime = dto.endTime ?? formatTimeString(existing.endTime);
    this.assertRange(startTime, endTime);

    const updated = await tx.workingHour.update({
      where: { id },
      data: {
        weekday: dto.weekday,
        startTime: dto.startTime ? parseTimeString(dto.startTime) : undefined,
        endTime: dto.endTime ? parseTimeString(dto.endTime) : undefined,
      },
    });
    return this.serialize(updated);
  }

  async remove(tx: TenantTx, professionalId: string, id: string) {
    const existing = await tx.workingHour.findFirst({ where: { id, professionalId } });
    if (!existing) throw new NotFoundException();

    await tx.workingHour.delete({ where: { id } });
    return { success: true };
  }

  private assertRange(startTime: string, endTime: string): void {
    if (startTime >= endTime) {
      throw new BadRequestException('startTime precisa ser antes de endTime.');
    }
  }

  private serialize(row: WorkingHourRow) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      professionalId: row.professionalId,
      weekday: row.weekday,
      startTime: formatTimeString(row.startTime),
      endTime: formatTimeString(row.endTime),
    };
  }
}
