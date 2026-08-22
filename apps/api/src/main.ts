import 'dotenv/config';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // Dev-only: serve os arquivos enviados via /v1/tenants/me/logo direto do
  // disco local. Não sobrevive a um deploy no Render (sem disco persistente) —
  // ver seção 6.1.6 do CLAUDE.md, troca por Supabase Storage antes de produção.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
