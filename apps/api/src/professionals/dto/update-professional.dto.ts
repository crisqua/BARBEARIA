import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Sem email/senha aqui de propósito — troca de credencial não é escopo deste CRUD.
export class UpdateProfessionalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Matches(/^[0-9()+\-\s]{8,20}$/)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
