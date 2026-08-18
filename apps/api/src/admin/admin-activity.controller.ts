import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminActivityService } from './admin-activity.service';

/** /v1/admin/activity — feed de eventos recentes da plataforma pro Dashboard
 * do painel master. Só Super Admin, sem tenant context (mesmo padrão de
 * AdminDashboardController). */
@Controller('admin/activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminActivityController {
  constructor(private readonly adminActivityService: AdminActivityService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;
    return this.adminActivityService.list(safeLimit);
  }
}
