import { IsISO8601, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const MAX_RANGE_DAYS = 366;

@ValidatorConstraint({ name: 'MaxRangeDays', async: false })
class MaxRangeDaysConstraint implements ValidatorConstraintInterface {
  validate(to: string, args: ValidationArguments) {
    const dto = args.object as FinancialHealthQueryDto;
    if (!dto.from || !to) return true; // outra validação já cobre isso
    const fromDate = new Date(dto.from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return true;
    const days = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= MAX_RANGE_DAYS;
  }

  defaultMessage() {
    return `"to" deve ser maior ou igual a "from", e o período não pode passar de ${MAX_RANGE_DAYS} dias.`;
  }
}

export class FinancialHealthQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  @Validate(MaxRangeDaysConstraint)
  to!: string;
}
