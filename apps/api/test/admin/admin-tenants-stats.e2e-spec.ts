import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupSuperAdmin, cleanupTenantWithUser, seedSuperAdmin } from '../utils/seed-auth-fixtures';
import { BookingFixture, seedBookingFixture } from '../utils/seed-booking-fixtures';

describe('Stats de uma barbearia (/v1/admin/tenants/:id/stats)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let fxA: BookingFixture;
  let fxB: BookingFixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    fxA = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'stats-a' });
    fxB = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'stats-b' });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fxA.admin.tenantId).catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, fxB.admin.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode acessar', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxA.admin.tenantId}/stats`)
      .set('Authorization', `Bearer ${fxA.adminToken}`);
    expect(res.status).toBe(403);
  });

  it('404 pra barbearia inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants/00000000-0000-0000-0000-000000000000/stats')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });

  it('conta agendamentos do mês, profissionais ativos/inativos e clientes — só da barbearia pedida', async () => {
    await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fxA.clienteToken}`)
      .send({ serviceId: fxA.serviceId, professionalId: fxA.professionalId, startsAt: fxA.testSlotIso });

    const inactiveProf = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${fxA.adminToken}`)
      .send({ name: 'Inativo Teste', email: `inativo-${Date.now()}@test.local`, password: 'senha-forte-123' });
    await request(app.getHttpServer())
      .patch(`/v1/professionals/${inactiveProf.body.id}`)
      .set('Authorization', `Bearer ${fxA.adminToken}`)
      .send({ active: false });

    // Ruído: agendamento e profissional na OUTRA barbearia — não pode vazar pra cá.
    await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fxB.clienteToken}`)
      .send({ serviceId: fxB.serviceId, professionalId: fxB.professionalId, startsAt: fxB.testSlotIso });

    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxA.admin.tenantId}/stats`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.appointmentsThisMonth).toBe(1);
    expect(res.body.professionalsActive).toBe(1); // só o criado pela fixture — o inativo não conta
    expect(res.body.professionalsInactive).toBe(1);
    expect(res.body.clientsCount).toBe(1);
    expect(Array.isArray(res.body.monthlyAppointments)).toBe(true);
    expect(res.body.monthlyAppointments).toHaveLength(6);
    expect(res.body.monthlyAppointments[5].count).toBeGreaterThanOrEqual(1); // mês corrente é o último da série
  });
});
