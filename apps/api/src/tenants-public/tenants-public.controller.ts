import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { tenantBrandingCacheKey } from './tenant-branding-cache-key';

const CACHE_TTL_SECONDS = 300;

export interface PublicTenantBranding {
  slug: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

/**
 * Leitura pública, sem autenticação — o front precisa resolver cor/logo/nome
 * do tenant a partir do slug ANTES do login (roteamento por subdomínio,
 * seção 4 do CLAUDE.md). Cacheada porque bater no banco a cada carregamento
 * de página pública seria desperdício (seção 8.3).
 */
@Controller('public/tenants')
export class TenantsPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<PublicTenantBranding> {
    const cacheKey = tenantBrandingCacheKey(slug);
    const cached = await this.cache.get<PublicTenantBranding>(cacheKey);
    if (cached) {
      return cached;
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status !== 'active') {
      // Não revela se um tenant suspenso existe — mesma resposta de "não existe".
      throw new NotFoundException();
    }

    const branding: PublicTenantBranding = {
      slug: tenant.slug,
      name: tenant.name,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      logoUrl: tenant.logoUrl,
    };

    await this.cache.set(cacheKey, branding, CACHE_TTL_SECONDS);
    return branding;
  }
}
