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

describe('POST /v1/auth/login', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantUser: SeededTenantUser;
  let superAdmin: { userId: string; email: string; password: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    tenantUser = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'login-test',
      role: 'admin',
    });
    superAdmin = await seedSuperAdmin(prisma);
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, tenantUser.tenantId);
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('loga usuário de tenant com credenciais corretas', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: tenantUser.tenantSlug,
      email: tenantUser.email,
      password: tenantUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ tenantId: tenantUser.tenantId, role: 'admin' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/barberaria_refresh=/);
  });

  it('rejeita senha errada', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: tenantUser.tenantSlug,
      email: tenantUser.email,
      password: 'senha-errada',
    });

    expect(res.status).toBe(401);
  });

  it('rejeita tenantSlug inexistente sem revelar se o tenant existe', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: 'tenant-que-nao-existe-xyz',
      email: tenantUser.email,
      password: tenantUser.password,
    });

    expect(res.status).toBe(401);
  });

  it('rejeita login em tenant suspenso com mensagem específica (403, não 401 genérico)', async () => {
    await prisma.tenant.update({ where: { id: tenantUser.tenantId }, data: { status: 'suspended' } });
    try {
      const res = await request(app.getHttpServer()).post('/v1/auth/login').send({
        tenantSlug: tenantUser.tenantSlug,
        email: tenantUser.email,
        password: tenantUser.password,
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/suspenso/i);
    } finally {
      await prisma.tenant.update({ where: { id: tenantUser.tenantId }, data: { status: 'active' } });
    }
  });

  it('loga Super Admin sem tenantSlug, com tenantId null no retorno', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').send({
      email: superAdmin.email,
      password: superAdmin.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ tenantId: null, role: 'super_admin' });
  });
});
