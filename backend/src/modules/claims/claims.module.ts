import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { Claim } from './claim.entity';
import { ClaimDraft } from './claim-draft.entity';
import { ClaimEvent } from './claim-event.entity';
import { ClaimIntakeConfig } from './claim-intake-config.entity';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { Policy } from '../policies/policy.entity';
import { Insurer } from '../insurers/insurer.entity';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { WorkTask } from '../producer-workflow/work-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Claim,
      ClaimDraft,
      ClaimEvent,
      ClaimIntakeConfig,
      Customer,
      Policy,
      Insurer,
      Conversation,
      Message,
      WorkTask,
    ]),
  ],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}

