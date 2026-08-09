import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';

@Global()
@Module({
  providers: [PrismaService, TenantContextService, TenantContextInterceptor],
  exports: [PrismaService, TenantContextService, TenantContextInterceptor],
})
export class PrismaModule {}
