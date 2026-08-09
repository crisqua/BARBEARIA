import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CacheService } from '../../src/cache/cache.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { tenantBrandingCacheKey } from '../../src/tenants-public/tenant-branding-cache-key';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('GET /v1/public/tenants/:slug', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let cache: CacheService;
  let admin: SeededTenantUser;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    cache = app.get(CacheService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'public-cache', role: 'admin' });
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: admin.tenantSlug,
      email: admin.email,
      password: admin.password,
    });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await app.close();
  });

  it('retorna branding do tenant ativo e popula o cache', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/public/tenants/${admin.tenantSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(admin.tenantSlug);

    const cached = await cache.get(tenantBrandingCacheKey(admin.tenantSlug));
    expect(cached).not.toBeNull();
  });

  it('404 para slug inexistente', async () => {
    const res = await request(app.getHttpServer()).get('/v1/public/tenants/nao-existe-xyz');
    expect(res.status).toBe(404);
  });

  it('invalida o cache quando o admin atualiza a marca', async () => {
    await request(app.getHttpServer()).get(`/v1/public/tenants/${admin.tenantSlug}`); // popula o cache

    await request(app.getHttpServer())
      .patch('/v1/tenants/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nome Atualizado Cache' });

    const res = await request(app.getHttpServer()).get(`/v1/public/tenants/${admin.tenantSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nome Atualizado Cache');
  });
});
