import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ClaimIntakeFieldKey =
  | 'customerId'
  | 'policyId'
  | 'type'
  | 'eventDatetime'
  | 'eventLocation'
  | 'narrative';

export type ClaimIntakeFieldDefinition = {
  key: ClaimIntakeFieldKey;
  label: string;
  placeholder?: string;
  required?: boolean;
};

@Entity({ name: 'claim_intake_configs' })
export class ClaimIntakeConfig {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'fields', type: 'jsonb' })
  fields!: ClaimIntakeFieldDefinition[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

