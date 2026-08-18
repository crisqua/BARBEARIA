import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

const SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * `users` tem RLS forçado — cross-tenant direto só funciona pras linhas com
   * tenant_id NULL (super_admin, carve-out da migration 0002). Pros demais
   * papéis, soma por tenant via TenantContextService, mesmo mecanismo do
   * dashboard (admin-dashboard.service.ts) — sem bypass de RLS novo.
   */
  async list(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const items: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      active: boolean;
      createdAt: Date;
      tenantId: string | null;
      tenantName: string | null;
    }> = [];

    const includeSuperAdmin = (!query.role || query.role === 'super_admin') && !query.tenantId;
    if (includeSuperAdmin) {
      const superAdmins = await this.prisma.user.findMany({ where: { role: 'super_admin' }, select: SELECT });
      items.push(...superAdmins.map((u) => ({ ...u, tenantId: null, tenantName: null })));
    }

    const includeTenantScoped = !query.role || query.role !== 'super_admin';
    if (includeTenantScoped) {
      const tenants = await this.prisma.tenant.findMany({
        where: query.tenantId ? { id: query.tenantId } : undefined,
        select: { id: true, name: true },
      });
      const roleFilter = query.role && query.role !== 'super_admin' ? query.role : undefined;

      const perTenant = await Promise.all(
        tenants.map((t) =>
          this.tenantContext
            .runInTenantContext(t.id, (tx) =>
              tx.user.findMany({ where: roleFilter ? { role: roleFilter } : undefined, select: SELECT }),
            )
            .then((users) => users.map((u) => ({ ...u, tenantId: t.id, tenantName: t.name }))),
        ),
      );
      items.push(...perTenant.flat());
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }
}
