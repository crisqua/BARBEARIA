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
  seedUserInTenant,
} from '../utils/seed-auth-fixtures';

describe('Diretório de usuários do Super Admin (/v1/admin/users)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let regularAdminToken: string;
  let seededTenant: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'users-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode listar', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${regularAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('um usuário criado num tenant aparece na lista, com o nome do tenant certo', async () => {
    const barbeiro = await seedUserInTenant(prisma, tenantContext, seededTenant.tenantId, 'barbeiro');

    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .query({ pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.items.find((u: { id: string }) => u.id === barbeiro.userId);
    expect(found).toMatchObject({ role: 'barbeiro', tenantId: seededTenant.tenantId, tenantName: `Barbearia users-admin` });
  });

  it('filtra por role', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .query({ role: 'admin', pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.every((u: { role: string }) => u.role === 'admin')).toBe(true);
    expect(res.body.items.some((u: { id: string }) => u.id === seededTenant.userId)).toBe(true);
  });

  it('filtra por tenantId', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .query({ tenantId: seededTenant.tenantId, pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.every((u: { tenantId: string }) => u.tenantId === seededTenant.tenantId)).toBe(true);
  });

  it('lista o próprio super_admin, sem tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .query({ role: 'super_admin', pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.items.find((u: { id: string }) => u.id === superAdmin.userId);
    expect(found).toMatchObject({ role: 'super_admin', tenantId: null, tenantName: null });
  });
});
