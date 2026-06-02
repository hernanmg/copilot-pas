import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export type OrchestratorChannel = 'WEB' | 'WHATSAPP';

// Acepta cualquier string con forma UUID (8-4-4-4-12 hex), incluidos los UUIDs demo no-v4.
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export class OrchestratorChatDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsIn(['WEB', 'WHATSAPP'])
  channel?: OrchestratorChannel;

  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @Matches(UUID_RE)
  customerId?: string;
}

