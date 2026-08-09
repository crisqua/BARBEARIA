import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração compartilhada entre main.ts e os testes e2e — evita divergência entre os dois. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.setGlobalPrefix('v1', { exclude: ['health'] });
}
