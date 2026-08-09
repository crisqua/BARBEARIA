import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantsPublicModule } from './tenants-public/tenants-public.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    AdminModule,
    TenantsModule,
    TenantsPublicModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
