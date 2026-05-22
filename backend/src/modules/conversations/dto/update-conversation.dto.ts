import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { PG_UUID_HEX_RE } from '../../../validation/pg-uuid';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  topic?: string;

  /** OPEN | CLOSED */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(PG_UUID_HEX_RE, { message: 'customerId must be a UUID' })
  customerId?: string | null;
}
