import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalsService } from './professionals.service';

@Controller('professionals')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Body() dto: CreateProfessionalDto,
  ) {
    return this.professionalsService.create(tx, requireTenantId(user), dto);
  }

  @Get()
  @Roles('admin', 'barbeiro', 'cliente')
  list(@CurrentTenant() tx: TenantTx, @Query() query: PaginationQueryDto) {
    return this.professionalsService.list(tx, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(':id')
  @Roles('admin', 'barbeiro', 'cliente')
  findOne(@CurrentTenant() tx: TenantTx, @Param('id') id: string) {
    return this.professionalsService.findOne(tx, id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentTenant() tx: TenantTx, @Param('id') id: string, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(tx, id, dto);
  }
}
