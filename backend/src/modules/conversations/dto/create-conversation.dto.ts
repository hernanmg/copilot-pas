import { IsOptional, IsString, Matches } from 'class-validator';
import { PG_UUID_HEX_RE } from '../../../validation/pg-uuid';

export class CreateConversationDto {
  @IsOptional()
  @Matches(PG_UUID_HEX_RE, { message: 'customerId must be a UUID' })
  customerId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  topic?: string;
}
