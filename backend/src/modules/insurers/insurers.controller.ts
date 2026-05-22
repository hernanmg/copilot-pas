import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateInsurerDto } from './dto/create-insurer.dto';
import { InsurersService } from './insurers.service';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('insurers')
export class InsurersController {
  constructor(private readonly insurers: InsurersService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.insurers.list(tenantId);
  }

  @Post()
  create(@Body() dto: CreateInsurerDto, @CurrentTenant() tenantId: string) {
    return this.insurers.create(tenantId, dto);
  }
}
