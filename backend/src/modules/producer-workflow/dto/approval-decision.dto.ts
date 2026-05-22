import { IsIn } from 'class-validator';

export class ApprovalDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
