import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { nowInBarbershopTime } from '../common/time.util';
import { hashPassword } from '../common/password.util';
import { revertNeedsReschedule } from '../common/revert-needs-reschedule.util';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

const PUBLIC_SELECT = {
  id: true,
  tenantId: true,
  role: true,
  name: true,
  email: true,
  phone: true,
  active: true,
  commissionPercentage: true,
  createdAt: true,
} as const;

/** Prisma serializa Decimal como string (ex: "12.50") — normaliza para number|null na resposta da API. */
function serializeProfessional<T extends { commissionPercentage: unknown }>(professional: T) {
  return {
    ...professional,
    commissionPercentage:
      professional.commissionPercentage != null ? Number(professional.commissionPercentage) : null,
  };
}

@Injectable()
export class ProfessionalsService {
  async create(tx: TenantTx, tenantId: string, dto: CreateProfessionalDto) {
    const existing = await tx.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado nesta barbearia.');
    }

    const passwordHash = await hashPassword(dto.password);
    const professional = await tx.user.create({
      data: {
        tenantId,
        role: 'barbeiro',
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        commissionPercentage: dto.commissionPercentage,
      },
      select: PUBLIC_SELECT,
    });
    return serializeProfessional(professional);
  }

  async list(tx: TenantTx, page: number, pageSize: number) {
    const where = { role: 'barbeiro' };

    const [items, total] = await Promise.all([
      tx.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: PUBLIC_SELECT,
      }),
      tx.user.count({ where }),
    ]);

    return { items: items.map(serializeProfessional), total, page, pageSize };
  }

  async findOne(tx: TenantTx, id: string) {
    const professional = await tx.user.findFirst({
      where: { id, role: 'barbeiro' },
      select: PUBLIC_SELECT,
    });
    if (!professional) throw new NotFoundException();
    return serializeProfessional(professional);
  }

  async update(tx: TenantTx, id: string, dto: UpdateProfessionalDto) {
    const before = await this.findOne(tx, id);
    const updated = await tx.user.update({ where: { id }, data: dto, select: PUBLIC_SELECT });
    const professional = serializeProfessional(updated);

    let affectedAppointmentsCount = 0;
    let revertedAppointmentsCount = 0;
    if (before.active && dto.active === false) {
      const result = await tx.appointment.updateMany({
        where: {
          professionalId: id,
          status: 'scheduled',
          startsAt: { gte: nowInBarbershopTime() },
        },
        data: { status: 'needs_reschedule' },
      });
      affectedAppointmentsCount = result.count;
    } else if (!before.active && dto.active === true) {
      revertedAppointmentsCount = await revertNeedsReschedule(tx, { professionalId: id });
    }

    return { ...professional, affectedAppointmentsCount, revertedAppointmentsCount };
  }

  /** Usado por professional-services e working-hours antes de criar a associação —
   * a FK composta garante o tenant certo, mas não distingue papel (barbeiro vs cliente/admin). */
  async assertIsProfessional(tx: TenantTx, id: string): Promise<void> {
    const exists = await tx.user.findFirst({ where: { id, role: 'barbeiro' }, select: { id: true } });
    if (!exists) throw new NotFoundException('Profissional não encontrado.');
  }
}
