import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantsPublicModule } from './tenants-public/tenants-public.module';
import { ServicesModule } from './services/services.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
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
    ServicesModule,
    ProfessionalsModule,
    AppointmentsModule,
    ExpensesModule,
    ExpenseCategoriesModule,
    FinanceiroModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
