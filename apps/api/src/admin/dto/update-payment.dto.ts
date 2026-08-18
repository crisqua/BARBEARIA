import { IsIn, IsOptional } from 'class-validator';

export class UpdatePaymentDto {
  // marcar como 'paid' seta paidAt = agora automaticamente no service, se ainda não tiver.
  @IsIn(['paid', 'pending'])
  status!: string;
}
