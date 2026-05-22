import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private tenant(h?: string): string {
    return h?.trim() || DUMMY_TENANT_ID;
  }

  @Get()
  async list(@Headers('x-tenant-id') tenantId?: string) {
    return this.customersService.findAllByTenant(this.tenant(tenantId));
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto, @Headers('x-tenant-id') tenantId?: string) {
    return this.customersService.create(this.tenant(tenantId), dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, this.tenant(tenantId), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Headers('x-tenant-id') tenantId?: string) {
    await this.customersService.remove(id, this.tenant(tenantId));
  }
}
