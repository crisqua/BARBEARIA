import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateWorkingHourDto } from './dto/create-working-hour.dto';
import { UpdateWorkingHourDto } from './dto/update-working-hour.dto';
import { ProfessionalsService } from './professionals.service';
import { WorkingHoursService } from './working-hours.service';

@Controller('professionals/:professionalId/working-hours')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class WorkingHoursController {
  constructor(
    private readonly workingHoursService: WorkingHoursService,
    private readonly professionalsService: ProfessionalsService,
  ) {}

  @Get()
  @Roles('admin', 'barbeiro', 'cliente')
  list(@CurrentTenant() tx: TenantTx, @Param('professionalId') professionalId: string) {
    return this.workingHoursService.list(tx, professionalId);
  }

  @Post()
  @Roles('admin')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Body() dto: CreateWorkingHourDto,
  ) {
    await this.professionalsService.assertIsProfessional(tx, professionalId);
    return this.workingHoursService.create(tx, requireTenantId(user), professionalId, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkingHourDto,
  ) {
    return this.workingHoursService.update(tx, professionalId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Param('id') id: string,
  ) {
    return this.workingHoursService.remove(tx, professionalId, id);
  }
}
