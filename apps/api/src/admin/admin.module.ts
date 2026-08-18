import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminActivityController } from './admin-activity.controller';
import { AdminActivityService } from './admin-activity.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPayoutsController } from './admin-payouts.controller';
import { AdminPayoutsService } from './admin-payouts.service';
import { AdminPlansController } from './admin-plans.controller';
import { AdminPlansService } from './admin-plans.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
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
    AdminPaymentsController,
    AdminPayoutsController,
    AdminSettingsController,
    AdminActivityController,
  ],
  providers: [
    AdminTenantsService,
    AdminDashboardService,
    AdminUsersService,
    AdminPlansService,
    AdminSubscriptionsService,
    AdminPaymentsService,
    AdminPayoutsService,
    AdminSettingsService,
    AdminActivityService,
  ],
})
export class AdminModule {}
