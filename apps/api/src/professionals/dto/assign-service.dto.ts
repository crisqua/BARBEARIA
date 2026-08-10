import { IsUUID } from 'class-validator';

export class AssignServiceDto {
  @IsUUID()
  serviceId!: string;
}
