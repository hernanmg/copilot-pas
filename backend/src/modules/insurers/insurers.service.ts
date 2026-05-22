import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insurer } from './insurer.entity';
import { CreateInsurerDto } from './dto/create-insurer.dto';

@Injectable()
export class InsurersService {
  constructor(
    @InjectRepository(Insurer)
    private readonly repo: Repository<Insurer>,
  ) {}

  list(tenantId: string): Promise<Insurer[]> {
    return this.repo.find({
      where: { tenantId },
      order: { name: 'ASC' },
      take: 200,
    });
  }

  async create(tenantId: string, dto: CreateInsurerDto): Promise<Insurer> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('name es requerido');

    const entity = this.repo.create({
      tenantId,
      name,
      code: dto.code?.trim() || null,
      apiBaseUrl: dto.apiBaseUrl?.trim() || null,
      apiKey: dto.apiKey?.trim() || null,
    });
    return this.repo.save(entity);
  }
}

