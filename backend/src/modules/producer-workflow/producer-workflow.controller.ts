import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ProducerWorkflowService } from './producer-workflow.service';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('producer')
export class ProducerWorkflowController {
  constructor(private readonly producerWorkflow: ProducerWorkflowService) {}

  @Get('metrics')
  metrics(@CurrentTenant() tenantId: string) {
    return this.producerWorkflow.getMetrics(tenantId);
  }

  @Get('assignable-users')
  assignableUsers(@CurrentTenant() tenantId: string) {
    return this.producerWorkflow.listAssignableUsers(tenantId);
  }

  @Get('approvals')
  listApprovals(@CurrentTenant() tenantId: string) {
    return this.producerWorkflow.listApprovals(tenantId);
  }

  @Patch('approvals/:id')
  decideApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() body: ApprovalDecisionDto,
  ) {
    return this.producerWorkflow.decideApproval(tenantId, id, body.status);
  }

  @Post('tasks')
  createTask(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateTaskDto,
  ) {
    return this.producerWorkflow.createTask(tenantId, body);
  }

  @Get('tasks')
  listTasks(
    @CurrentTenant() tenantId: string,
    @Query('overdue') overdue?: string,
  ) {
    return this.producerWorkflow.listTasks(tenantId, overdue === '1' || overdue === 'true');
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.producerWorkflow.updateTask(tenantId, id, body);
  }
}
