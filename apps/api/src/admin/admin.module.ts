import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminPlansController } from './admin-plans.controller';
import { AdminPlansService } from './admin-plans.service';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    AdminTenantsController,
    AdminDashboardController,
    AdminUsersController,
    AdminPlansController,
    AdminSubscriptionsController,
  ],
  providers: [
    AdminTenantsService,
    AdminDashboardService,
    AdminUsersService,
    AdminPlansService,
    AdminSubscriptionsService,
  ],
})
export class AdminModule {}
