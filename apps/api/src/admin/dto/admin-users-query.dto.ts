import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['super_admin', 'admin', 'barbeiro', 'cliente'])
  role?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
