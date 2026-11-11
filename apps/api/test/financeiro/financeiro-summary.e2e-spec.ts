import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, SeededUser, cleanupTenantWithUser, seedUserInTenant, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('Resumo financeiro (/v1/financeiro/summary)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let cliente: SeededUser;
  let barbeiro: SeededUser;
  let adminToken: string;
  let barbeiroToken: string;

  const FROM = '2026-11-01T00:00:00.000Z';
  const TO = '2026-11-30T23:59:59.000Z';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'fin-admin', role: 'admin' });
    cliente = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'cliente');
    barbeiro = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'barbeiro');

    adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: admin.email, password: admin.password })
    ).body.accessToken;

    barbeiroToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: barbeiro.email, password: barbeiro.password })
    ).body.accessToken;

    await tenantContext.runInTenantContext(admin.tenantId, async (tx) => {
      const serviceA = await tx.service.create({
        data: { tenantId: admin.tenantId, name: 'Corte', priceCents: 5000, durationMinutes: 30 },
      });
      const serviceB = await tx.service.create({
        data: { tenantId: admin.tenantId, name: 'Barba', priceCents: 3000, durationMinutes: 20 },
      });

      // 2 completed (50,00 + 30,00 = R$ 80,00) dentro do período
      await tx.appointment.create({
        data: {
          tenantId: admin.tenantId, clientId: cliente.userId, professionalId: barbeiro.userId, serviceId: serviceA.id,
          startsAt: new Date('2026-11-10T13:00:00.000Z'), endsAt: new Date('2026-11-10T13:30:00.000Z'), status: 'completed',
        },
      });
      await tx.appointment.create({
        data: {
          tenantId: admin.tenantId, clientId: cliente.userId, professionalId: barbeiro.userId, serviceId: serviceB.id,
          startsAt: new Date('2026-11-12T10:00:00.000Z'), endsAt: new Date('2026-11-12T10:20:00.000Z'), status: 'completed',
        },
      });
      // scheduled não entra na receita
      await tx.appointment.create({
        data: {
          tenantId: admin.tenantId, clientId: cliente.userId, professionalId: barbeiro.userId, serviceId: serviceA.id,
          startsAt: new Date('2026-11-15T13:00:00.000Z'), endsAt: new Date('2026-11-15T13:30:00.000Z'), status: 'scheduled',
        },
      });

      // despesas: insumos 12,00 + fixas 8,00 = R$ 20,00
      await tx.expense.create({
        data: {
          tenantId: admin.tenantId, createdBy: admin.userId, category: 'insumos', description: 'Produtos',
          amountCents: 1200, paymentMethod: 'pix', expenseDate: new Date('2026-11-05'),
        },
      });
      await tx.expense.create({
        data: {
          tenantId: admin.tenantId, createdBy: admin.userId, category: 'fixas', description: 'Aluguel',
          amountCents: 800, paymentMethod: 'transferencia', expenseDate: new Date('2026-11-06'),
        },
      });
    });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await app.close();
  });

  it('calcula receita (só completed), despesas, saldo e ticket médio corretamente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/financeiro/summary?from=${FROM}&to=${TO}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.receitaCents).toBe(8000);
    expect(res.body.despesasCents).toBe(2000);
    expect(res.body.saldoCents).toBe(6000);
    expect(res.body.ticketMedioCents).toBe(4000);
    expect(res.body.despesasPorCategoria).toEqual(
      expect.arrayContaining([
        { category: 'insumos', totalCents: 1200 },
        { category: 'fixas', totalCents: 800 },
      ]),
    );
  });

  it('barbeiro não pode acessar o resumo financeiro', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/financeiro/summary?from=${FROM}&to=${TO}`)
      .set('Authorization', `Bearer ${barbeiroToken}`);
    expect(res.status).toBe(403);
  });
});
