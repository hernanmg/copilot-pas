import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'claims' })
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'policy_id', type: 'uuid' })
  policyId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'producer_id', type: 'uuid', nullable: true })
  producerId?: string;

  @Column({ name: 'external_claim_number', type: 'text', nullable: true })
  externalClaimNumber?: string;

  @Column()
  type!: string;

  @Column()
  status!: string;

  @Column({ name: 'event_datetime', type: 'timestamptz', nullable: true })
  eventDatetime?: Date;

  @Column({ name: 'event_location', type: 'text', nullable: true })
  eventLocation?: string;

  @Column({ type: 'text', nullable: true })
  narrative?: string;

  @Column({ name: 'requires_human_review', default: false })
  requiresHumanReview!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

