import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { FinanceiroService } from './financeiro.service';

@Controller('financeiro')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Get('summary')
  @Roles('admin')
  summary(@CurrentTenant() tx: TenantTx, @Query() query: SummaryQueryDto) {
    return this.financeiroService.summary(tx, query);
  }
}
