import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFinancialHealthService } from './admin-financial-health.service';
import { FinancialHealthQueryDto } from './dto/financial-health-query.dto';

/** Sprint 29 — relatório de faturamento/despesas/atendimentos de UMA
 * barbearia, por período escolhido pelo Super Admin. Sempre com um
 * tenantId já selecionado (drill-down a partir da tela Financeiro) —
 * nunca uma visão agregada de todas as barbearias. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminFinancialHealthController {
  constructor(private readonly adminFinancialHealthService: AdminFinancialHealthService) {}

  @Get('admin/tenants/:tenantId/financial-health')
  getFinancialHealth(@Param('tenantId') tenantId: string, @Query() query: FinancialHealthQueryDto) {
    return this.adminFinancialHealthService.getFinancialHealth(tenantId, query);
  }
}
