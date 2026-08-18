import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** `code` é fixo por decisão de negócio (ver admin-desenvolvain.md) — imutável após criado. */
export class CreatePlanDto {
  @IsIn(['trial', 'pro', 'enterprise'])
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  limitLabel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
