import { Body, Controller, ForbiddenException, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { tenantBrandingCacheKey } from '../tenants-public/tenant-branding-cache-key';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';

/**
 * /v1/tenants/me — Admin da barbearia. Sempre filtra pelo tenant_id do JWT,
 * nunca aceita outro id via parâmetro (seção 6.4 do CLAUDE.md). `tenants` não
 * tem RLS, então essa rota não usa TenantContextInterceptor — o isolamento
 * aqui é o WHERE explícito abaixo, não SET LOCAL/RLS.
 */
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.loadOwnTenant(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTenantBrandingDto) {
    const tenantId = this.requireTenantId(user);
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
    await this.cache.del(tenantBrandingCacheKey(updated.slug));
    return updated;
  }

  private async loadOwnTenant(user: AuthenticatedUser) {
    const tenantId = this.requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException();
    return tenant;
  }

  private requireTenantId(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException();
    }
    return user.tenantId;
  }
}
