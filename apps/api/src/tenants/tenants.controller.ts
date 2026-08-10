import { Body, Controller, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CacheService } from '../cache/cache.service';
import { requireTenantId } from '../common/require-tenant-id';
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
    const tenant = await this.prisma.tenant.findUnique({ where: { id: requireTenantId(user) } });
    if (!tenant) throw new NotFoundException();
    return tenant;
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTenantBrandingDto) {
    const updated = await this.prisma.tenant.update({
      where: { id: requireTenantId(user) },
      data: dto,
    });
    await this.cache.del(tenantBrandingCacheKey(updated.slug));
    return updated;
  }
}
