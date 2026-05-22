import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { signAccessToken, verifyAccessToken } from './jwt.util';
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

  async meFromBearer(authHeader?: string) {
    const raw = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!raw) {
      throw new UnauthorizedException('Falta Authorization: Bearer <token>');
    }
    let payload: { sub: string; tid: string };
    try {
      payload = verifyAccessToken(raw, this.secret());
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    const user = await this.users.getPublicById(payload.tid, payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return { tenantId: payload.tid, user };
  }
}
