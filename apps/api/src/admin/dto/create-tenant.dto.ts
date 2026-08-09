import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

class InitialAdminDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

/** Provisionamento: cria o tenant e o admin inicial na mesma requisição (seção 6.4 do CLAUDE.md). */
export class CreateTenantDto {
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug deve ser minúsculo, alfanumérico, com hífens entre segmentos',
  })
  @MinLength(2)
  @MaxLength(63)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  secondaryColor?: string;

  @ValidateNested()
  @Type(() => InitialAdminDto)
  admin!: InitialAdminDto;
}
