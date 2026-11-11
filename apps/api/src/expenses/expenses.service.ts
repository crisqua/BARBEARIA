import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  async create(tx: TenantTx, tenantId: string, createdBy: string, dto: CreateExpenseDto) {
    return tx.expense.create({
      data: {
        tenantId,
        createdBy,
        category: dto.category,
        description: dto.description,
        amountCents: dto.amountCents,
        paymentMethod: dto.paymentMethod,
        expenseDate: new Date(dto.expenseDate),
      },
    });
  }

  async list(tx: TenantTx, query: ListExpensesQueryDto) {
    const where: Prisma.ExpenseWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.from || query.to) {
      where.expenseDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      tx.expense.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { expenseDate: 'desc' },
      }),
      tx.expense.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async update(tx: TenantTx, id: string, dto: UpdateExpenseDto) {
    await this.findOneOrThrow(tx, id);
    return tx.expense.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        amountCents: dto.amountCents,
        paymentMethod: dto.paymentMethod,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
      },
    });
  }

  async remove(tx: TenantTx, id: string) {
    await this.findOneOrThrow(tx, id);
    await tx.expense.delete({ where: { id } });
    return { success: true };
  }

  private async findOneOrThrow(tx: TenantTx, id: string) {
    const expense = await tx.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException();
    return expense;
  }
}
