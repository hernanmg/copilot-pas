import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { CreateInsurerDto } from './dto/create-insurer.dto';
import { InsurersService } from './insurers.service';

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('insurers')
export class InsurersController {
  constructor(private readonly insurers: InsurersService) {}

  @Get()
  list(@Headers('x-tenant-id') tenantId?: string) {
    return this.insurers.list(tenantId || DUMMY_TENANT_ID);
  }

  @Post()
  create(@Body() dto: CreateInsurerDto, @Headers('x-tenant-id') tenantId?: string) {
    return this.insurers.create(tenantId || DUMMY_TENANT_ID, dto);
  }
}

