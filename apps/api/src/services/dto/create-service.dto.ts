import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes!: number;
}
