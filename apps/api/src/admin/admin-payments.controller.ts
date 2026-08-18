import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminPaymentsService } from './admin-payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

/** Pagamentos de assinatura — registro manual (Sprint 6). `payments` tem RLS
 * normal, então mutação é sempre nested sob o tenant (ver admin-subscriptions). */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Get('admin/payments')
  list(@Query() query: PaginationQueryDto) {
    return this.adminPaymentsService.list(query);
  }

  @Post('admin/tenants/:tenantId/payments')
  create(@Param('tenantId') tenantId: string, @Body() dto: CreatePaymentDto) {
    return this.adminPaymentsService.createForTenant(tenantId, dto);
  }

  @Patch('admin/tenants/:tenantId/payments/:id')
  update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.adminPaymentsService.updateForTenant(tenantId, id, dto);
  }
}
