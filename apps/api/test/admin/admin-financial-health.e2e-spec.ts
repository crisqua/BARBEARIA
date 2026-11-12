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

describe('Saúde financeira de uma barbearia (/v1/admin/tenants/:id/financial-health)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let fxA: SeededTenantUser;
  let fxB: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    superAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: superAdmin.email, password: superAdmin.password })
    ).body.accessToken;

    fxA = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'fin-health-a', role: 'admin' });
    fxB = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'fin-health-b', role: 'admin' });

    await tenantContext.runInTenantContext(fxA.tenantId, async (tx) => {
      const cliente = await tx.user.create({
        data: { tenantId: fxA.tenantId, role: 'cliente', name: 'Cliente A', email: `cliente-${Date.now()}@test.local`, passwordHash: 'x' },
      });
      const barbeiro = await tx.user.create({
        data: { tenantId: fxA.tenantId, role: 'barbeiro', name: 'Barbeiro A', email: `barbeiro-${Date.now()}@test.local`, passwordHash: 'x' },
      });
      const corte = await tx.service.create({ data: { tenantId: fxA.tenantId, name: 'Corte', priceCents: 5000, durationMinutes: 30 } });
      const barba = await tx.service.create({ data: { tenantId: fxA.tenantId, name: 'Barba', priceCents: 3000, durationMinutes: 20 } });

      // ── janela principal: 2026-11-01 a 2026-11-07 (7 dias → 7 baldes de 1 dia)
      await tx.appointment.create({
        data: { tenantId: fxA.tenantId, clientId: cliente.id, professionalId: barbeiro.id, serviceId: corte.id,
          startsAt: new Date('2026-11-01T13:00:00.000Z'), endsAt: new Date('2026-11-01T13:30:00.000Z'), status: 'completed' },
      });
      await tx.appointment.create({
        data: { tenantId: fxA.tenantId, clientId: cliente.id, professionalId: barbeiro.id, serviceId: barba.id,
          startsAt: new Date('2026-11-04T10:00:00.000Z'), endsAt: new Date('2026-11-04T10:20:00.000Z'), status: 'completed' },
      });
      // scheduled não entra na receita
      await tx.appointment.create({
        data: { tenantId: fxA.tenantId, clientId: cliente.id, professionalId: barbeiro.id, serviceId: corte.id,
          startsAt: new Date('2026-11-05T13:00:00.000Z'), endsAt: new Date('2026-11-05T13:30:00.000Z'), status: 'scheduled' },
      });
      await tx.expense.create({
        data: { tenantId: fxA.tenantId, createdBy: fxA.userId, category: 'insumos', description: 'Produtos',
          amountCents: 1200, paymentMethod: 'pix', expenseDate: new Date('2026-11-02') },
      });
      await tx.expense.create({
        data: { tenantId: fxA.tenantId, createdBy: fxA.userId, category: 'fixas', description: 'Aluguel',
          amountCents: 800, paymentMethod: 'transferencia', expenseDate: new Date('2026-11-07') },
      });

      // ── período anterior (2026-10-25 a 2026-10-31) — pra conferir "previous"
      await tx.appointment.create({
        data: { tenantId: fxA.tenantId, clientId: cliente.id, professionalId: barbeiro.id, serviceId: barba.id,
          startsAt: new Date('2026-10-30T10:00:00.000Z'), endsAt: new Date('2026-10-30T10:20:00.000Z'), status: 'completed' },
      });
      await tx.expense.create({
        data: { tenantId: fxA.tenantId, createdBy: fxA.userId, category: 'outras', description: 'Diversos',
          amountCents: 500, paymentMethod: 'dinheiro', expenseDate: new Date('2026-10-26') },
      });

      // ── janela de 14 dias (2026-09-01 a 2026-09-14) → 7 baldes de 2 dias, pra testar o agrupamento
      await tx.appointment.create({
        data: { tenantId: fxA.tenantId, clientId: cliente.id, professionalId: barbeiro.id, serviceId: corte.id,
          startsAt: new Date('2026-09-08T13:00:00.000Z'), endsAt: new Date('2026-09-08T13:30:00.000Z'), status: 'completed' },
      });
    });

    // Ruído na OUTRA barbearia, mesmas datas — não pode vazar pra cá.
    await tenantContext.runInTenantContext(fxB.tenantId, async (tx) => {
      const clienteB = await tx.user.create({
        data: { tenantId: fxB.tenantId, role: 'cliente', name: 'Cliente B', email: `cliente-b-${Date.now()}@test.local`, passwordHash: 'x' },
      });
      const barbeiroB = await tx.user.create({
        data: { tenantId: fxB.tenantId, role: 'barbeiro', name: 'Barbeiro B', email: `barbeiro-b-${Date.now()}@test.local`, passwordHash: 'x' },
      });
      const servicoB = await tx.service.create({ data: { tenantId: fxB.tenantId, name: 'Corte B', priceCents: 9999, durationMinutes: 30 } });
      await tx.appointment.create({
        data: { tenantId: fxB.tenantId, clientId: clienteB.id, professionalId: barbeiroB.id, serviceId: servicoB.id,
          startsAt: new Date('2026-11-01T13:00:00.000Z'), endsAt: new Date('2026-11-01T13:30:00.000Z'), status: 'completed' },
      });
      await tx.expense.create({
        data: { tenantId: fxB.tenantId, createdBy: fxB.userId, category: 'insumos', description: 'Ruído',
          amountCents: 9999, paymentMethod: 'pix', expenseDate: new Date('2026-11-02') },
      });
    });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fxA.tenantId).catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, fxB.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode acessar', async () => {
    const adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: fxA.tenantSlug, email: fxA.email, password: fxA.password })
    ).body.accessToken;

    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxA.tenantId}/financial-health?from=2026-11-01T00:00:00.000Z&to=2026-11-07T23:59:59.000Z`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('404 pra barbearia inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants/00000000-0000-0000-0000-000000000000/financial-health?from=2026-11-01T00:00:00.000Z&to=2026-11-07T23:59:59.000Z')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });

  it('agrega receita/despesas/atendimentos por balde, totais e período anterior — só da barbearia pedida', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxA.tenantId}/financial-health?from=2026-11-01T00:00:00.000Z&to=2026-11-07T23:59:59.000Z`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({ from: '2026-11-01', to: '2026-11-07' });

    expect(res.body.totals).toEqual({ receitaCents: 8000, despesasCents: 2000, atendimentos: 2 });

    expect(res.body.previous.range).toEqual({ from: '2026-10-25', to: '2026-10-31' });
    expect(res.body.previous).toMatchObject({ receitaCents: 3000, despesasCents: 500, atendimentos: 1 });

    expect(res.body.buckets).toHaveLength(7);
    expect(res.body.buckets[0]).toMatchObject({ from: '2026-11-01', to: '2026-11-01', receitaCents: 5000, atendimentos: 1 });
    expect(res.body.buckets[1]).toMatchObject({ from: '2026-11-02', to: '2026-11-02', despesasCents: 1200 });
    expect(res.body.buckets[2]).toMatchObject({ from: '2026-11-03', to: '2026-11-03', receitaCents: 0, despesasCents: 0, atendimentos: 0 });
    expect(res.body.buckets[3]).toMatchObject({ from: '2026-11-04', to: '2026-11-04', receitaCents: 3000, atendimentos: 1 });
    expect(res.body.buckets[6]).toMatchObject({ from: '2026-11-07', to: '2026-11-07', despesasCents: 800 });
  });

  it('agrupa em baldes de 2 dias quando o período tem mais de 7 dias (clamp em 7 baldes)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxA.tenantId}/financial-health?from=2026-09-01T00:00:00.000Z&to=2026-09-14T23:59:59.000Z`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(7);
    // dia 08/09 cai no 4º balde (07–08/09)
    expect(res.body.buckets[3]).toMatchObject({ from: '2026-09-07', to: '2026-09-08', receitaCents: 5000, atendimentos: 1 });
    expect(res.body.totals).toMatchObject({ receitaCents: 5000, atendimentos: 1 });
  });
});
