import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantTx } from '../prisma/tenant-context.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles('cliente')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(tx, requireTenantId(user), user.id, dto);
  }

  @Get()
  @Roles('admin', 'barbeiro', 'cliente')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.list(tx, user, query);
  }

  @Get(':id')
  @Roles('admin', 'barbeiro', 'cliente')
  findOne(@CurrentUser() user: AuthenticatedUser, @CurrentTenant() tx: TenantTx, @Param('id') id: string) {
    return this.appointmentsService.findOne(tx, id, user);
  }

  @Patch(':id/cancel')
  @Roles('admin', 'cliente')
  cancel(@CurrentUser() user: AuthenticatedUser, @CurrentTenant() tx: TenantTx, @Param('id') id: string) {
    return this.appointmentsService.cancel(tx, id, user);
  }

  @Patch(':id/reschedule')
  @Roles('admin', 'cliente')
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(tx, id, user, dto);
  }
}
