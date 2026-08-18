import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminTenantsController, AdminDashboardController],
  providers: [AdminTenantsService, AdminDashboardService],
})
export class AdminModule {}
