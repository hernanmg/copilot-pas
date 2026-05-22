import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED'] as const;

export class PatchClaimDto {
  @IsOptional()
  @IsIn([...STATUSES])
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  requiresHumanReview?: boolean;
}
