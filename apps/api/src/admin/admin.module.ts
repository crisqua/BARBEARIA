import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminTenantsController],
  providers: [AdminTenantsService],
})
export class AdminModule {}
