import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

/**
 * Ainda não existe rota autenticada de escrita de negócio (services/appointments
 * chegam nas Sprints 4/5) — o teste equivalente contra essas rotas é recriado lá.
 * Por enquanto prova o mecanismo na borda: nenhum DTO da API declara tenantId/
 * tenant_id como campo aceito, então o ValidationPipe (forbidNonWhitelisted)
 * rejeita qualquer tentativa de injetar isso no body, em qualquer rota validada.
 */
describe('7.3 — Manipulação de tenant_id no body', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantUser: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    tenantUser = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'body-override',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, tenantUser.tenantId);
    await app.close();
  });

  it.each(['tenantId', 'tenant_id'])('register rejeita body com campo extra "%s"', async (field) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantSlug: tenantUser.tenantSlug,
        [field]: 'valor-arbitrario',
        name: 'Cliente',
        email: `x-${field}-${Date.now()}@test.local`,
        password: 'senha-forte-123',
      });

    expect(res.status).toBe(400);
  });

  it.each(['tenantId', 'tenant_id'])('login rejeita body com campo extra "%s"', async (field) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        tenantSlug: tenantUser.tenantSlug,
        email: tenantUser.email,
        password: tenantUser.password,
        [field]: 'valor-arbitrario',
      });

    expect(res.status).toBe(400);
  });
});
