import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword } from '../common/password.util';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { tenantBrandingCacheKey } from '../tenants-public/tenant-branding-cache-key';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Cria o tenant e o admin inicial na MESMA transação — se a criação do admin
   * falhar, o tenant não fica órfão. `tenants` não tem RLS, então a criação do
   * tenant funciona em qualquer contexto; para o INSERT em `users` (que tem
   * FORCE RLS) precisamos do set_config manual aqui dentro, porque o tenant
   * ainda não existia quando a transação começou — TenantContextService não
   * serve nesse caso específico (ele assume um tenant_id já conhecido).
   */
  async create(dto: CreateTenantDto) {
    const passwordHash = await hashPassword(dto.admin.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: dto.slug,
            name: dto.name,
            primaryColor: dto.primaryColor,
            secondaryColor: dto.secondaryColor,
          },
        });

        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            role: 'admin',
            name: dto.admin.name,
            email: dto.admin.email,
            passwordHash,
          },
        });

        return { tenant, admin: { id: admin.id, email: admin.email } };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Slug já em uso.');
      }
      throw err;
    }
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException();
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    const updated = await this.prisma.tenant.update({ where: { id }, data: dto });
    await this.cache.del(tenantBrandingCacheKey(updated.slug));
    return updated;
  }
}
