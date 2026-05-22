import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsIn(['INBOUND', 'OUTBOUND'])
  direction!: 'INBOUND' | 'OUTBOUND';

  @IsIn(['CUSTOMER', 'PRODUCER', 'AI'])
  senderType!: 'CUSTOMER' | 'PRODUCER' | 'AI';

  @IsOptional()
  @IsString()
  text?: string;
}

