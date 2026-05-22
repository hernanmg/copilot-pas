import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export type OrchestratorChannel = 'WEB' | 'WHATSAPP';

export class OrchestratorChatDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsIn(['WEB', 'WHATSAPP'])
  channel?: OrchestratorChannel;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}

