import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { signAccessToken } from './jwt.util';
import type { LoginDto } from './dto/login.dto';

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 7; // 7 días

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  private secret(): string {
    return process.env.JWT_SECRET || 'dev-only-cambiar-JWT_SECRET-en-produccion';
  }

  async login(dto: LoginDto) {
    const user = await this.users.validateLogin(dto.tenantId, dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const accessToken = signAccessToken({ sub: user.id, tid: dto.tenantId }, this.secret(), DEFAULT_TTL_SEC);
    const profile = await this.users.getPublicById(dto.tenantId, user.id);
    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresInSec: DEFAULT_TTL_SEC,
      tenantId: dto.tenantId,
      user: profile,
    };
  }

  async getProfile(tenantId: string, userId: string) {
    const user = await this.users.getPublicById(tenantId, userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return { tenantId, user };
  }
}
