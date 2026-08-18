import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

/**
 * Assinaturas — só Super Admin. `subscriptions` tem RLS normal (dado do
 * tenant, não da plataforma), então as rotas por tenant usam
 * TenantContextService por baixo (ver admin-subscriptions.service.ts).
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminSubscriptionsController {
  constructor(private readonly adminSubscriptionsService: AdminSubscriptionsService) {}

  @Get('admin/subscriptions')
  list(@Query() query: PaginationQueryDto) {
    return this.adminSubscriptionsService.list(query);
  }

  @Get('admin/tenants/:tenantId/subscription')
  findForTenant(@Param('tenantId') tenantId: string) {
    return this.adminSubscriptionsService.findForTenant(tenantId);
  }

  @Patch('admin/tenants/:tenantId/subscription')
  upsertForTenant(@Param('tenantId') tenantId: string, @Body() dto: UpdateSubscriptionDto) {
    return this.adminSubscriptionsService.upsertForTenant(tenantId, dto);
  }
}
