import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';

describe('POST /v1/auth/register', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantId: string;
  let tenantSlug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tenantSlug = `register-test-${uniqueSuffix}`;
    const tenant = await prisma.tenant.create({ data: { slug: tenantSlug, name: 'Barbearia Teste' } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await tenantContext.runInTenantContext(tenantId, (tx) => tx.user.deleteMany({ where: { tenantId } }));
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('cria um cliente e devolve accessToken + cookie de refresh', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/register').send({
      tenantSlug,
      name: 'Cliente Teste',
      email: `cliente-${Date.now()}@test.local`,
      password: 'senha-forte-123',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ tenantId, role: 'cliente' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/barberaria_refresh=/);
  });

  it('rejeita e-mail duplicado no mesmo tenant', async () => {
    const email = `dup-${Date.now()}@test.local`;
    const payload = { tenantSlug, name: 'Dup', email, password: 'senha-forte-123' };

    await request(app.getHttpServer()).post('/v1/auth/register').send(payload).expect(201);
    const second = await request(app.getHttpServer()).post('/v1/auth/register').send(payload);

    expect(second.status).toBe(409);
  });

  it('rejeita tenantSlug inexistente', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/register').send({
      tenantSlug: 'tenant-que-nao-existe-xyz',
      name: 'Cliente',
      email: `no-tenant-${Date.now()}@test.local`,
      password: 'senha-forte-123',
    });

    expect(res.status).toBe(404);
  });

  it('rejeita body com campo tenantId não declarado no DTO (regra 6.1.1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantSlug,
        tenantId: 'algum-id-arbitrario',
        name: 'Cliente',
        email: `injected-${Date.now()}@test.local`,
        password: 'senha-forte-123',
      });

    expect(res.status).toBe(400);
  });
});
