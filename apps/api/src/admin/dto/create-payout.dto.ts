import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePayoutDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  period!: string;

  @IsInt()
  @Min(0)
  grossRevenueCents!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePct!: number;

  @IsOptional()
  @IsIn(['paid', 'pending'])
  status?: string;
}
