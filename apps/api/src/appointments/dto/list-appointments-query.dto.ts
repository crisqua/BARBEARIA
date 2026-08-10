import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAppointmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsIn(['scheduled', 'cancelled', 'completed', 'needs_reschedule'])
  status?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
