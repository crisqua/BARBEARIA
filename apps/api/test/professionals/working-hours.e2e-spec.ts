import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('Horários de trabalho (/v1/professionals/:id/working-hours)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let adminToken: string;
  let clienteToken: string;
  let professionalId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'wh-admin', role: 'admin' });

    adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: admin.email, password: admin.password })
    ).body.accessToken;

    const clienteEmail = `wh-cliente-${Date.now()}@test.local`;
    await request(app.getHttpServer()).post('/v1/auth/register').send({
      tenantSlug: admin.tenantSlug,
      name: 'Cliente WH',
      email: clienteEmail,
      password: 'senha-forte-123',
    });
    clienteToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: clienteEmail, password: 'senha-forte-123' })
    ).body.accessToken;

    const profRes = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Barbeiro WH', email: `wh-barbeiro-${Date.now()}@test.local`, password: 'senha-forte-123' });
    professionalId = profRes.body.id;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await app.close();
  });

  let workingHourId: string;

  it('admin cria um bloco de horário', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: 1, startTime: '09:00', endTime: '18:00' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ weekday: 1, startTime: '09:00', endTime: '18:00' });
    workingHourId = res.body.id;
  });

  it('rejeita startTime >= endTime', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: 2, startTime: '18:00', endTime: '09:00' });

    expect(res.status).toBe(400);
  });

  it('rejeita weekday fora do intervalo 0-6', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: 7, startTime: '09:00', endTime: '18:00' });

    expect(res.status).toBe(400);
  });

  it('rejeita formato de horário inválido', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: 2, startTime: '9h', endTime: '18:00' });

    expect(res.status).toBe(400);
  });

  it('cliente consegue listar, mas não criar', async () => {
    const list = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((wh: { id: string }) => wh.id === workingHourId)).toBe(true);

    const create = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ weekday: 3, startTime: '09:00', endTime: '12:00' });
    expect(create.status).toBe(403);
  });

  it('admin atualiza o bloco de horário', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}/working-hours/${workingHourId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startTime: '10:00' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ startTime: '10:00', endTime: '18:00' });
  });

  it('admin remove o bloco de horário', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/professionals/${professionalId}/working-hours/${workingHourId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const list = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((wh: { id: string }) => wh.id === workingHourId)).toBe(false);
  });

  it('criar horário para profissional inexistente dá 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/professionals/00000000-0000-0000-0000-000000000000/working-hours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: 1, startTime: '09:00', endTime: '18:00' });

    expect(res.status).toBe(404);
  });
});
