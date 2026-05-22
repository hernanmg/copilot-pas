import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me() {
    return { message: 'Usá GET /auth/me con header Authorization: Bearer <token>' };
  }

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || '00000000-0000-0000-0000-000000000000';
    const user = await this.usersService.create(effectiveTenantId, dto);
    // Nunca devolvemos passwordHash
    const { passwordHash, ...safe } = user as any;
    return safe;
  }
}

