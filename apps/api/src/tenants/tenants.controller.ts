import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Request } from 'express';
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

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB — mesmo limite já usado no onboarding do admin-desenvolvain
const LOGO_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
};

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

  /**
   * Upload real do logo — MVP local: salva em disco (`uploads/logos/`, servido
   * estaticamente por `main.ts`) e grava a URL absoluta em `tenants.logoUrl`.
   * Dev-only por natureza: Render não tem disco persistente entre deploys.
   * Antes de produção, trocar por presigned URL do Supabase Storage
   * (seção 6.1.6 do CLAUDE.md) sem mudar o contrato desta rota.
   */
  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES } }))
  async uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');

    const extension = LOGO_MIME_EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Formato inválido. Use PNG, JPG ou SVG.');
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Arquivo muito grande. Tamanho máximo: 2MB.');
    }

    const tenantId = requireTenantId(user);
    const dir = join(process.cwd(), 'uploads', 'logos');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filename = `${tenantId}-${randomUUID()}.${extension}`;
    writeFileSync(join(dir, filename), file.buffer);

    const logoUrl = `${req.protocol}://${req.get('host')}/uploads/logos/${filename}`;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
    });
    await this.cache.del(tenantBrandingCacheKey(updated.slug));
    return updated;
  }
}
