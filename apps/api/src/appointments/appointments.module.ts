import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [AuthModule],
  controllers: [AppointmentsController, AvailabilityController],
  providers: [AppointmentsService, AvailabilityService],
})
export class AppointmentsModule {}
