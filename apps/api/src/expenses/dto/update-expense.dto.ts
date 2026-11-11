import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const CATEGORIES = ['insumos', 'fixas', 'outras'] as const;
const PAYMENT_METHODS = ['pix', 'cartao', 'dinheiro', 'transferencia'] as const;

export class UpdateExpenseDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_00)
  amountCents?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsISO8601()
  expenseDate?: string;
}
