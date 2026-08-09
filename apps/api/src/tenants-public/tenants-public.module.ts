import { Module } from '@nestjs/common';
import { TenantsPublicController } from './tenants-public.controller';

@Module({
  controllers: [TenantsPublicController],
})
export class TenantsPublicModule {}
