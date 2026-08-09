import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Usado pela rota de self-service do Admin da barbearia — de propósito SEM
 * campo `status`. Só o Super Admin pode suspender/ativar um tenant (seção 6.4).
 */
export class UpdateTenantBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  secondaryColor?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  logoUrl?: string;
}
