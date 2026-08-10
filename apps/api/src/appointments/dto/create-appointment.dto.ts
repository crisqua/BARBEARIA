import { IsISO8601, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  professionalId!: string;

  @IsISO8601()
  startsAt!: string;
}
