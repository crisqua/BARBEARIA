import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Sem `code` de propósito — imutável após criado (ver create-plan.dto.ts).
export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  // null explicito = volta a ser "negociado" (sem preço fixo, plano Enterprise).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number | null;

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
