import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.findOne(tx, id);
    return tx.service.update({ where: { id }, data: dto });
  }
}
