import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(tx, requireTenantId(user), user.id, dto);
  }

  @Get()
  @Roles('admin')
  list(@CurrentTenant() tx: TenantTx, @Query() query: ListExpensesQueryDto) {
    return this.expensesService.list(tx, query);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentTenant() tx: TenantTx, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(tx, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@CurrentTenant() tx: TenantTx, @Param('id') id: string) {
    return this.expensesService.remove(tx, id);
  }
}
