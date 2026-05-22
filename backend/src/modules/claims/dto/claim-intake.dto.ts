import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartClaimIntakeDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
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
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}

