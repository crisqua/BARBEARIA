import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServicesController } from './services.controller';
import { ServicesProfessionalsController } from './services-professionals.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [AuthModule],
  controllers: [ServicesController, ServicesProfessionalsController],
  providers: [ServicesService],
})
export class ServicesModule {}
