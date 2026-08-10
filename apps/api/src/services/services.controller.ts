import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(tx, requireTenantId(user), dto);
  }

  @Get()
  @Roles('admin', 'barbeiro', 'cliente')
  list(@CurrentTenant() tx: TenantTx, @Query() query: ListServicesQueryDto) {
    return this.servicesService.list(tx, query.page ?? 1, query.pageSize ?? 20, query.activeOnly);
  }

  @Get(':id')
  @Roles('admin', 'barbeiro', 'cliente')
  findOne(@CurrentTenant() tx: TenantTx, @Param('id') id: string) {
    return this.servicesService.findOne(tx, id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentTenant() tx: TenantTx, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(tx, id, dto);
  }
}
