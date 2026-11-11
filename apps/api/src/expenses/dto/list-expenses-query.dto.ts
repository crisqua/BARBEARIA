import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const CATEGORIES = ['insumos', 'fixas', 'outras'] as const;

export class ListExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
