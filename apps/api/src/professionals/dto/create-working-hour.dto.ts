import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateWorkingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime deve estar no formato HH:mm' })
  endTime!: string;
}
