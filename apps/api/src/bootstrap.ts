import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configuração compartilhada entre main.ts e os testes e2e — evita divergência entre os dois. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());

  // credentials:true é obrigatório pro cookie httpOnly de refresh (seção 6.1.2)
  // funcionar entre o front (ex: localhost:5173) e a API em outra origem/porta.
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.setGlobalPrefix('v1', { exclude: ['health'] });
}
