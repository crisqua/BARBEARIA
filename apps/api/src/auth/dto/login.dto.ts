import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;

  /**
   * Omitido = login de Super Admin (tenant_id NULL). Informado = login de
   * usuário de uma barbearia específica. Interino até a Sprint 3 trazer
   * roteamento por subdomínio (slug.barberaria.app) e resolver isso pelo Host.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  tenantSlug?: string;
}
