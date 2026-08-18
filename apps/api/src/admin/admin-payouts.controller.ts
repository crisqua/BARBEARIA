import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminPayoutsService } from './admin-payouts.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';

/** Repasse de receita à barbearia — registro manual (Sprint 6). Mesma
 * arquitetura nested de admin-payments.controller.ts. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminPayoutsController {
  constructor(private readonly adminPayoutsService: AdminPayoutsService) {}

  @Get('admin/payouts')
  list(@Query() query: PaginationQueryDto) {
    return this.adminPayoutsService.list(query);
  }

  @Post('admin/tenants/:tenantId/payouts')
  create(@Param('tenantId') tenantId: string, @Body() dto: CreatePayoutDto) {
    return this.adminPayoutsService.createForTenant(tenantId, dto);
  }

  @Patch('admin/tenants/:tenantId/payouts/:id')
  update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdatePayoutDto) {
    return this.adminPayoutsService.updateForTenant(tenantId, id, dto);
  }
}
