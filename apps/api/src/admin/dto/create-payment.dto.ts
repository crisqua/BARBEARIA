import { IsIn, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsInt()
  @Min(0)
  amountCents!: number;

  // "AAAA-MM" — igual ao formato usado no gráfico de MRR do Financeiro.
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period deve estar no formato AAAA-MM' })
  period!: string;

  @IsOptional()
  @IsIn(['paid', 'pending'])
  status?: string;
}
