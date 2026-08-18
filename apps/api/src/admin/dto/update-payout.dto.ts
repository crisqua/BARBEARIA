import { IsIn, IsOptional } from 'class-validator';

export class UpdatePayoutDto {
  @IsOptional()
  @IsIn(['paid', 'pending'])
  status?: string;
}
