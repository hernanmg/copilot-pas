import { Transform } from 'class-transformer';
import { IsISO8601, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PG_UUID_HEX_RE } from '../../../validation/pg-uuid';

const TYPES = ['AUTO', 'HOGAR', 'VIDA', 'OTRO'] as const;

export { PG_UUID_HEX_RE };

function trimEmptyToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const s = value.trim();
  return s === '' ? undefined : s;
}

export class PatchClaimDraftDto {
  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @Matches(PG_UUID_HEX_RE, { message: 'customerId must be a UUID' })
  customerId?: string;

  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @Matches(PG_UUID_HEX_RE, { message: 'policyId must be a UUID' })
  policyId?: string;

  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @IsIn([...TYPES])
  type?: (typeof TYPES)[number];

  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @IsISO8601()
  eventDatetime?: string;

  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventLocation?: string;

  @Transform(({ value }) => trimEmptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  narrative?: string;
}

