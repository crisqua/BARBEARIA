import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class AdminPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto) {
    try {
      return await this.prisma.plan.create({
        data: {
          code: dto.code,
          name: dto.name,
          priceCents: dto.priceCents,
          limitLabel: dto.limitLabel,
          modules: dto.modules ?? [],
          active: dto.active ?? true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Já existe um plano com esse código.');
      }
      throw err;
    }
  }

  async list() {
    const items = await this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' } });
    return { items, total: items.length };
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException();
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }
}
