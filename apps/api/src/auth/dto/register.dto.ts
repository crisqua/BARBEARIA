import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Autocadastro é só para `cliente` — admin/barbeiro são provisionados por
 * quem já tem acesso (Super Admin / Admin da barbearia), não por rota pública.
 */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  tenantSlug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @Matches(/^[0-9()+\-\s]{8,20}$/)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
