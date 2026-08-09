import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Rotas /v1/admin/* — só Super Admin, SEM TenantContextInterceptor (seção 6.4
 * do CLAUDE.md). O CRUD real de tenants entra na Sprint 3; esta rota existe só
 * para provar a separação de guard/roteamento desde já.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('whoami')
  @Roles('super_admin')
  whoami(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
