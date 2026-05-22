import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class UpdateTaskDto {
  /** UUID del usuario del tenant, o null para quitar asignación */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID('4')
  assigneeUserId?: string | null;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

  /** ISO 8601; null borra vencimiento */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;
}
