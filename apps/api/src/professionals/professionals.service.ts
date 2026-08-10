import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../common/password.util';
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
  createdAt: true,
} as const;

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
    return tx.user.create({
      data: { tenantId, role: 'barbeiro', name: dto.name, email: dto.email, phone: dto.phone, passwordHash },
      select: PUBLIC_SELECT,
    });
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

    return { items, total, page, pageSize };
  }

  async findOne(tx: TenantTx, id: string) {
    const professional = await tx.user.findFirst({
      where: { id, role: 'barbeiro' },
      select: PUBLIC_SELECT,
    });
    if (!professional) throw new NotFoundException();
    return professional;
  }

  async update(tx: TenantTx, id: string, dto: UpdateProfessionalDto) {
    await this.findOne(tx, id);
    return tx.user.update({ where: { id }, data: dto, select: PUBLIC_SELECT });
  }

  /** Usado por professional-services e working-hours antes de criar a associação —
   * a FK composta garante o tenant certo, mas não distingue papel (barbeiro vs cliente/admin). */
  async assertIsProfessional(tx: TenantTx, id: string): Promise<void> {
    const exists = await tx.user.findFirst({ where: { id, role: 'barbeiro' }, select: { id: true } });
    if (!exists) throw new NotFoundException('Profissional não encontrado.');
  }
}
