import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class UsersController {
  @Get('me')
  @Roles('admin', 'barbeiro', 'cliente')
  async me(@CurrentUser() currentUser: AuthenticatedUser, @CurrentTenant() tx: TenantTx) {
    return this.loadUser(tx, currentUser.id);
  }

  // Rota de leitura simples, só pra ter algo com :id pra testar IDOR (seção 7.2
  // do CLAUDE.md) antes do CRUD de profissionais chegar na Sprint 4.
  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id') id: string, @CurrentTenant() tx: TenantTx) {
    return this.loadUser(tx, id);
  }

  private async loadUser(tx: TenantTx, id: string) {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException();
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  }
}
