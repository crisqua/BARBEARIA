import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  async list(tx: TenantTx) {
    return tx.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async create(tx: TenantTx, tenantId: string, dto: CreateExpenseCategoryDto) {
    try {
      return await tx.expenseCategory.create({ data: { tenantId, name: dto.name } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Essa categoria já existe.');
      }
      throw err;
    }
  }
}
