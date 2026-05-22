import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { ApprovalRequest } from './approval-request.entity';
import { WorkTask } from './work-task.entity';
import type { UpdateTaskDto } from './dto/update-task.dto';

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export type ProducerMetricsDto = {
  pendingApprovals: number;
  slaOverdue: number;
  openTasks: number;
};

@Injectable()
export class ProducerWorkflowService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly approvalRepo: Repository<ApprovalRequest>,
    @InjectRepository(WorkTask)
    private readonly taskRepo: Repository<WorkTask>,
    private readonly usersService: UsersService,
  ) {}

  resolveTenant(tenantId?: string): string {
    return tenantId?.trim() || DUMMY_TENANT_ID;
  }

  async getMetrics(tenantId?: string): Promise<ProducerMetricsDto> {
    const tid = this.resolveTenant(tenantId);
    const now = new Date();

    const pendingApprovals = await this.approvalRepo.count({
      where: { tenantId: tid, status: 'PENDING' },
    });

    const slaOverdue = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tid', { tid })
      .andWhere('t.status IN (:...open)', { open: ['OPEN', 'IN_PROGRESS'] })
      .andWhere('t.due_at IS NOT NULL')
      .andWhere('t.due_at < :now', { now })
      .getCount();

    const openTasks = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tid', { tid })
      .andWhere('t.status IN (:...st)', { st: ['OPEN', 'IN_PROGRESS'] })
      .getCount();

    return { pendingApprovals, slaOverdue, openTasks };
  }

  async listApprovals(tenantId: string) {
    const tid = this.resolveTenant(tenantId);
    return this.approvalRepo.find({
      where: { tenantId: tid },
      order: { createdAt: 'DESC' },
    });
  }

  async listTasks(tenantId: string, overdueOnly?: boolean) {
    const tid = this.resolveTenant(tenantId);
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tid', { tid })
      .andWhere('t.status IN (:...st)', { st: ['OPEN', 'IN_PROGRESS'] })
      .orderBy('t.due_at', 'ASC')
      .addOrderBy('t.created_at', 'DESC');

    if (overdueOnly) {
      const now = new Date();
      qb.andWhere('t.due_at IS NOT NULL').andWhere('t.due_at < :now', { now });
    }

    return qb.getMany();
  }

  async decideApproval(tenantId: string | undefined, id: string, status: 'APPROVED' | 'REJECTED') {
    const tid = this.resolveTenant(tenantId);
    const row = await this.approvalRepo.findOne({ where: { id, tenantId: tid } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Solo se puede aprobar o rechazar solicitudes en estado PENDING');
    }
    row.status = status;
    return this.approvalRepo.save(row);
  }

  async updateTask(tenantId: string | undefined, id: string, dto: UpdateTaskDto) {
    const tid = this.resolveTenant(tenantId);
    const task = await this.taskRepo.findOne({ where: { id, tenantId: tid } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    if (dto.assigneeUserId !== undefined) {
      if (dto.assigneeUserId === null) {
        task.assigneeUserId = null;
      } else {
        await this.usersService.assertUserBelongsToTenant(tid, dto.assigneeUserId);
        task.assigneeUserId = dto.assigneeUserId;
      }
    }

    if (dto.status !== undefined) {
      task.status = dto.status;
    }

    if (dto.dueAt !== undefined) {
      if (dto.dueAt === null) {
        task.dueAt = null;
      } else {
        task.dueAt = new Date(dto.dueAt);
      }
    }

    if (dto.type !== undefined) {
      task.type = dto.type;
    }

    return this.taskRepo.save(task);
  }

  listAssignableUsers(tenantId?: string) {
    return this.usersService.listActiveByTenant(this.resolveTenant(tenantId));
  }
}
