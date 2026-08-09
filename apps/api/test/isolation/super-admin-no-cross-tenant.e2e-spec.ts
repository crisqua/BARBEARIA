import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import {
  SeededTenantUser,
  cleanupSuperAdmin,
  cleanupTenantWithUser,
  seedSuperAdmin,
  seedTenantWithUser,
} from '../utils/seed-auth-fixtures';

describe('7.9 — Super Admin não vira identidade cross-tenant', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantUser: SeededTenantUser;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let tenantAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    tenantUser = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'super-admin-test',
      role: 'admin',
    });
    superAdmin = await seedSuperAdmin(prisma);

    const superAdminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = superAdminLogin.body.accessToken;

    const tenantAdminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: tenantUser.tenantSlug,
      email: tenantUser.email,
      password: tenantUser.password,
    });
    tenantAdminToken = tenantAdminLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, tenantUser.tenantId);
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('Super Admin acessa /v1/admin/whoami e não pertence a tenant nenhum', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/whoami')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tenantId: null, role: 'super_admin' });
  });

  it('usuário de tenant não acessa /v1/admin/whoami', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/whoami')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(res.status).toBe(403);
  });

  it('Super Admin não acessa rota de tenant (/v1/users/me)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(403);
  });
});
