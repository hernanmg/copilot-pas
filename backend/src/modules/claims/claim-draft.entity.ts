import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ClaimDraftStatus = 'DRAFT' | 'CONVERTED' | 'CANCELLED';

@Entity({ name: 'claim_drafts' })
export class ClaimDraft {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'source_conversation_id', type: 'uuid', nullable: true })
  sourceConversationId?: string | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null;

  @Column({ name: 'policy_id', type: 'uuid', nullable: true })
  policyId?: string | null;

  @Column({ type: 'text', nullable: true })
  type?: string | null;

  @Column({ name: 'event_datetime', type: 'timestamptz', nullable: true })
  eventDatetime?: Date | null;

  @Column({ name: 'event_location', type: 'text', nullable: true })
  eventLocation?: string | null;

  @Column({ type: 'text', nullable: true })
  narrative?: string | null;

  @Column({ type: 'text', default: 'DRAFT' })
  status!: ClaimDraftStatus;

  @Column({ name: 'extracted_payload', type: 'jsonb', nullable: true })
  extractedPayload?: Record<string, unknown> | null;

  @Column({ name: 'missing_fields', type: 'jsonb', nullable: true })
  missingFields?: string[] | null;

  @Column({ name: 'converted_claim_id', type: 'uuid', nullable: true })
  convertedClaimId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

