import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
