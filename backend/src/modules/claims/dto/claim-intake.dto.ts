import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Acepta cualquier string con forma UUID (8-4-4-4-12 hex), incluidos los UUIDs demo no-v4.
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export class StartClaimIntakeDto {
  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  customerId?: string;

  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  policyId?: string;
}

export class SubmitClaimIntakeStepDto {
  @IsOptional()
  @IsIn(['AUTO', 'HOGAR', 'VIDA', 'OTRO'])
  type?: string;

  @IsOptional()
  @IsISO8601()
  eventDatetime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  narrative?: string;

  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  policyId?: string;

  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  customerId?: string;
}

