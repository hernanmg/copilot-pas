import { IsOptional, Matches, ValidateIf } from 'class-validator';
import { PG_UUID_HEX_RE } from '../../../validation/pg-uuid';

export class PatchPolicyDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(PG_UUID_HEX_RE, { message: 'insurerId must be a UUID' })
  insurerId?: string | null;
}
