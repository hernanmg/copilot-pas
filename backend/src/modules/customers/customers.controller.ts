import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@CurrentTenant() tenantId: string) {
    return this.customersService.findAllByTenant(tenantId);
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto, @CurrentTenant() tenantId: string) {
    return this.customersService.create(tenantId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenantId: string) {
    await this.customersService.remove(id, tenantId);
  }
}
