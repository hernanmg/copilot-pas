import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Insurer } from '../insurers/insurer.entity';
import { Policy } from './policy.entity';
import type { PatchPolicyDto } from './dto/patch-policy.dto';

type PolicyListRow = Policy & { insurer?: { id: string; name: string; code?: string | null } | null };

const POLICY_STATUSES = new Set(['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED']);

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(Policy)
    private readonly policiesRepo: Repository<Policy>,
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Insurer)
    private readonly insurersRepo: Repository<Insurer>,
  ) {}

  list(tenantId: string): Promise<Policy[]> {
    return this.policiesRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listForCustomer(tenantId: string, customerId: string, status?: string): Promise<PolicyListRow[]> {
    let rows = await this.policiesRepo.find({
      where: { tenantId, customerId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const st = status?.trim().toUpperCase();
    if (st && POLICY_STATUSES.has(st)) {
      rows = rows.filter((r) => r.status === st);
    }
    const insurerIds = [...new Set(rows.map((r) => r.insurerId).filter(Boolean))] as string[];
    const insurers = insurerIds.length
      ? await this.insurersRepo.find({ where: insurerIds.map((id) => ({ id, tenantId })) as any })
      : [];
    const byId = new Map(insurers.map((i) => [i.id, i]));
    const mapped = rows.map((p) => {
      const ins = p.insurerId ? byId.get(p.insurerId) : undefined;
      return {
        ...p,
        insurer: ins ? { id: ins.id, name: ins.name, code: ins.code ?? null } : null,
      };
    });
    mapped.sort((a, b) => {
      const ao = a.status === 'ACTIVE' ? 0 : 1;
      const bo = b.status === 'ACTIVE' ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.policyNumber.localeCompare(b.policyNumber);
    });
    return mapped;
  }

  async createDemo(tenantId: string, customerId: string): Promise<Policy> {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId, tenant: { id: tenantId } as any },
    });
    if (!customer) {
      throw new BadRequestException(
        'customerId no existe para este tenant. Creá/seleccioná un cliente real antes de crear una póliza demo.',
      );
    }

    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const end = new Date(now);
    end.setFullYear(end.getFullYear() + 1);
    const endDate = end.toISOString().slice(0, 10);
    const policyNumber = `DEMO-${Date.now()}`;

    const entity = this.policiesRepo.create({
      tenantId,
      customerId,
      policyNumber,
      status: 'ACTIVE',
      startDate,
      endDate,
      currency: 'ARS',
    });
    return this.policiesRepo.save(entity);
  }

  async patchPolicy(tenantId: string, policyId: string, dto: PatchPolicyDto): Promise<Policy> {
    const pol = await this.policiesRepo.findOne({ where: { id: policyId, tenantId } });
    if (!pol) throw new NotFoundException('Póliza no encontrada');

    if (dto.insurerId !== undefined) {
      if (dto.insurerId === null) {
        pol.insurerId = undefined;
      } else {
        const ins = await this.insurersRepo.findOne({ where: { id: dto.insurerId, tenantId } });
        if (!ins) throw new NotFoundException('Aseguradora no encontrada en este tenant');
        pol.insurerId = ins.id;
      }
    }

    return this.policiesRepo.save(pol);
  }

  /** Pólizas activas con fin en los próximos N días (alertas de renovación). */
  async summary(tenantId: string, windowDays = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + windowDays);
    const todayStr = today.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const renewingWithinWindow = await this.policiesRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tid', { tid: tenantId })
      .andWhere('p.status = :st', { st: 'ACTIVE' })
      .andWhere('p.end_date >= :from', { from: todayStr })
      .andWhere('p.end_date <= :to', { to: endStr })
      .getCount();

    const activeTotal = await this.policiesRepo.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    return {
      activeTotal,
      renewingWithinWindow,
      windowDays,
      from: todayStr,
      to: endStr,
    };
  }
}

