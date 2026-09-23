import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantsController } from './tenants.controller';
import { TenantLogoStorageService } from './tenant-logo-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
  providers: [TenantLogoStorageService],
})
export class TenantsModule {}
