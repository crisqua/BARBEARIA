import { Injectable, NotFoundException } from '@nestjs/common';
import { nowInBarbershopTime } from '../common/time.util';
import { revertNeedsReschedule } from '../common/revert-needs-reschedule.util';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  async create(tx: TenantTx, tenantId: string, dto: CreateServiceDto) {
    return tx.service.create({
      data: {
        tenantId,
        name: dto.name,
        priceCents: dto.priceCents,
        durationMinutes: dto.durationMinutes,
      },
    });
  }

  async list(tx: TenantTx, page: number, pageSize: number, activeOnly?: boolean) {
    const where = activeOnly ? { active: true } : {};

    const [items, total] = await Promise.all([
      tx.service.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      tx.service.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(tx: TenantTx, id: string) {
    const service = await tx.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException();
    return service;
  }

  async update(tx: TenantTx, id: string, dto: UpdateServiceDto) {
    const before = await this.findOne(tx, id);
    const service = await tx.service.update({ where: { id }, data: dto });

    let affectedAppointmentsCount = 0;
    let revertedAppointmentsCount = 0;
    if (before.active && dto.active === false) {
      const result = await tx.appointment.updateMany({
        where: {
          serviceId: id,
          status: 'scheduled',
          startsAt: { gte: nowInBarbershopTime() },
        },
        data: { status: 'needs_reschedule' },
      });
      affectedAppointmentsCount = result.count;
    } else if (!before.active && dto.active === true) {
      revertedAppointmentsCount = await revertNeedsReschedule(tx, { serviceId: id });
    }

    return { ...service, affectedAppointmentsCount, revertedAppointmentsCount };
  }
}
