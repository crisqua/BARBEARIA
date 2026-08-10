import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityService } from './availability.service';

@Controller('professionals/:professionalId/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('admin', 'barbeiro', 'cliente')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  get(
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getAvailableSlots(tx, professionalId, query.serviceId, query.date);
  }
}
