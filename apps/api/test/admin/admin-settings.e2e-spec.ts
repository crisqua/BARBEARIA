import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupSuperAdmin, seedSuperAdmin } from '../utils/seed-auth-fixtures';

describe('Configurações da plataforma (/v1/admin/settings)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let originalAccentColor: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    const current = await prisma.platformSettings.findFirst();
    originalAccentColor = current!.accentColor;
  });

  afterAll(async () => {
    await prisma.platformSettings.updateMany({ data: { accentColor: originalAccentColor } });
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('GET sempre retorna a linha única (nunca 404)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/settings')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      domain: expect.any(String),
      bgColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      accentColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
    });
  });

  it('rejeita hex inválido', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/admin/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ accentColor: 'lima' });
    expect(res.status).toBe(400);
  });

  it('atualiza a cor de acento e reflete no GET seguinte', async () => {
    const patch = await request(app.getHttpServer())
      .patch('/v1/admin/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ accentColor: '#FF00AA' });
    expect(patch.status).toBe(200);
    expect(patch.body.accentColor).toBe('#FF00AA');

    const get = await request(app.getHttpServer())
      .get('/v1/admin/settings')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(get.body.accentColor).toBe('#FF00AA');
  });
});
