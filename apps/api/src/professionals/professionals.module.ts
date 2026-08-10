import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalServicesController } from './professional-services.controller';
import { WorkingHoursController } from './working-hours.controller';
import { ProfessionalsService } from './professionals.service';
import { WorkingHoursService } from './working-hours.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfessionalsController, ProfessionalServicesController, WorkingHoursController],
  providers: [ProfessionalsService, WorkingHoursService],
})
export class ProfessionalsModule {}
