import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

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
    @CurrentTenant() tenantId: string,
  ) {
    const user = await this.usersService.create(tenantId, dto);
    const { passwordHash, ...safe } = user as any;
    return safe;
  }
}
