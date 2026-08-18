import { IsEmail, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  webhookUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  defaultTrialDays?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  bgColor?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;
}
