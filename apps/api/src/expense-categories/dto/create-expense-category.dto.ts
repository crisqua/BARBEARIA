import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;
}
