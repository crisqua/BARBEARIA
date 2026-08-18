import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: string;
}
