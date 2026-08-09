import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminTenantsService } from './admin-tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

/**
 * /v1/admin/tenants/* — só Super Admin, sem tenant context (seção 6.4 do
 * CLAUDE.md). Acesso irrestrito a todas as linhas de `tenants`.
 */
@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminTenantsController {
  constructor(private readonly adminTenantsService: AdminTenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.adminTenantsService.create(dto);
  }

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.adminTenantsService.list(query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminTenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.adminTenantsService.update(id, dto);
  }
}
