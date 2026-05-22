import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ApprovalRequest } from './approval-request.entity';
import { WorkTask } from './work-task.entity';
import { ProducerWorkflowController } from './producer-workflow.controller';
import { ProducerWorkflowService } from './producer-workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRequest, WorkTask]), UsersModule],
  controllers: [ProducerWorkflowController],
  providers: [ProducerWorkflowService],
  exports: [ProducerWorkflowService],
})
export class ProducerWorkflowModule {}
