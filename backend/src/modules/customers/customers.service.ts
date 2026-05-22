import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  findAllByTenant(tenantId: string): Promise<Customer[]> {
    return this.repo.find({
      where: { tenant: { id: tenantId } as { id: string } },
      order: { createdAt: 'DESC' },
    });
  }

  async create(tenantId: string, dto: CreateCustomerDto): Promise<Customer> {
    const entity = this.repo.create({
      ...dto,
      tenant: { id: tenantId } as { id: string },
    });
    return this.repo.save(entity);
  }

  async update(id: string, tenantId: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.repo.findOne({
      where: { id, tenant: { id: tenantId } as { id: string } },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (dto.fullName !== undefined) {
      const n = dto.fullName.trim();
      if (!n) throw new BadRequestException('El nombre no puede quedar vacío');
      customer.fullName = n;
    }
    if (dto.documentType !== undefined) {
      customer.documentType = dto.documentType?.trim() || undefined;
    }
    if (dto.documentNumber !== undefined) {
      customer.documentNumber = dto.documentNumber?.trim() || undefined;
    }
    if (dto.email !== undefined) {
      customer.email = dto.email?.trim() || undefined;
    }
    if (dto.phoneWhatsapp !== undefined) {
      customer.phoneWhatsapp = dto.phoneWhatsapp?.trim() || undefined;
    }
    return this.repo.save(customer);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const result = await this.repo.delete({
      id,
      tenant: { id: tenantId } as { id: string },
    });
    if (!result.affected) throw new NotFoundException('Cliente no encontrado');
  }
}
