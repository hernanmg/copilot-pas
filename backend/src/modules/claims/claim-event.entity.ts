import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'claim_events' })
export class ClaimEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
