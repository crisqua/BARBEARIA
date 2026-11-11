import { IsIn, IsInt, IsISO8601, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const PAYMENT_METHODS = ['pix', 'cartao', 'dinheiro', 'transferencia'] as const;

export class CreateExpenseDto {
  // Texto livre (Sprint 28.3) — "insumos"/"fixas"/"outras" fixas no frontend +
  // categorias cadastradas por tenant via ExpenseCategory, não uma FK aqui.
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_00)
  amountCents!: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsISO8601()
  expenseDate!: string;
}
