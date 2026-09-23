import { IsIn } from 'class-validator';

export const LOGO_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
};

export class PresignLogoDto {
  @IsIn(Object.keys(LOGO_MIME_EXTENSIONS), { message: 'Formato inválido. Use PNG, JPG ou SVG.' })
  contentType!: string;
}
