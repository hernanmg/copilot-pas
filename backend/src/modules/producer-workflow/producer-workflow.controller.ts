import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ProducerWorkflowService } from './producer-workflow.service';

@Controller('producer')
export class ProducerWorkflowController {
  constructor(private readonly producerWorkflow: ProducerWorkflowService) {}

  @Get('metrics')
  metrics(@Headers('x-tenant-id') tenantId?: string) {
    return this.producerWorkflow.getMetrics(tenantId);
  }

  @Get('assignable-users')
  assignableUsers(@Headers('x-tenant-id') tenantId?: string) {
    return this.producerWorkflow.listAssignableUsers(tenantId);
  }

  @Get('approvals')
  listApprovals(@Headers('x-tenant-id') tenantId?: string) {
    return this.producerWorkflow.listApprovals(tenantId || '');
  }

  @Patch('approvals/:id')
  decideApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() body: ApprovalDecisionDto,
  ) {
    return this.producerWorkflow.decideApproval(tenantId, id, body.status);
  }

  @Get('tasks')
  listTasks(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Query('overdue') overdue?: string,
  ) {
    return this.producerWorkflow.listTasks(tenantId || '', overdue === '1' || overdue === 'true');
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() body: UpdateTaskDto,
  ) {
    return this.producerWorkflow.updateTask(tenantId, id, body);
  }
}
