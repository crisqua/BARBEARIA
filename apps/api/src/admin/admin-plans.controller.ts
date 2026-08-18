import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPlansService } from './admin-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

/**
 * /v1/admin/plans — só Super Admin, sem tenant context. Catálogo global de
 * planos (não é dado de tenant, mesmo padrão de AdminTenantsController).
 */
@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminPlansController {
  constructor(private readonly adminPlansService: AdminPlansService) {}

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.adminPlansService.create(dto);
  }

  @Get()
  list() {
    return this.adminPlansService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminPlansService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminPlansService.update(id, dto);
  }
}
