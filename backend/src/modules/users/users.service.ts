import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

export type PublicUser = { id: string; email: string; displayName: string; role: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(tenantId: string, dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.repo.findOne({
      where: { tenant: { id: tenantId } as any, email }
    });
    if (existing) throw new BadRequestException('El email ya existe en este tenant');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const entity = this.repo.create({
      tenant: { id: tenantId } as any,
      email,
      passwordHash,
      role: dto.role,
      displayName: dto.displayName,
      isActive: true
    });
    return this.repo.save(entity);
  }

  async listActiveByTenant(tenantId: string) {
    const rows = await this.repo
      .createQueryBuilder('u')
      .where('u.tenant_id = :tid', { tid: tenantId })
      .andWhere('u.is_active = :act', { act: true })
      .orderBy('u.displayName', 'ASC')
      .select(['u.id', 'u.email', 'u.displayName', 'u.role'])
      .getMany();
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
    }));
  }

  async assertUserBelongsToTenant(tenantId: string, userId: string): Promise<void> {
    const n = await this.repo
      .createQueryBuilder('u')
      .where('u.id = :uid', { uid: userId })
      .andWhere('u.tenant_id = :tid', { tid: tenantId })
      .getCount();
    if (!n) throw new BadRequestException('El usuario no pertenece a este tenant');
  }

  async validateLogin(tenantId: string, email: string, password: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = await this.repo.findOne({
      where: { email: normalized, tenant: { id: tenantId } as any },
    });
    if (!user || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async getPublicById(tenantId: string, userId: string): Promise<PublicUser | null> {
    const u = await this.repo.findOne({
      where: { id: userId, tenant: { id: tenantId } as any },
    });
    if (!u) return null;
    return { id: u.id, email: u.email, displayName: u.displayName, role: u.role };
  }
}

