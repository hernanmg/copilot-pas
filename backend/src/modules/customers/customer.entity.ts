import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ name: 'document_type', nullable: true })
  documentType?: string;

  @Column({ name: 'document_number', nullable: true })
  documentNumber?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'phone_whatsapp', nullable: true })
  phoneWhatsapp?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

