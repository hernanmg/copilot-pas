import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const FIELD_KEYS = [
  'customerId',
  'policyId',
  'type',
  'eventDatetime',
  'eventLocation',
  'narrative',
] as const;

export class ClaimIntakeFieldDto {
  @IsIn([...FIELD_KEYS])
  key!: (typeof FIELD_KEYS)[number];

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class PutClaimIntakeConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ClaimIntakeFieldDto)
  fields!: ClaimIntakeFieldDto[];
}

