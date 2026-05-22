import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PatchPolicyDto } from './dto/patch-policy.dto';

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get('summary')
  async summary(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Query('windowDays') windowDays?: string,
  ) {
    const w = windowDays ? Number.parseInt(windowDays, 10) : 30;
    const days = Number.isFinite(w) && w > 0 && w <= 365 ? w : 30;
    return this.policiesService.summary(tenantId || DUMMY_TENANT_ID, days);
  }

  @Get()
  async list(
    @Headers('x-tenant-id') tenantId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    const tid = tenantId || DUMMY_TENANT_ID;
    const cid = customerId?.trim();
    if (cid) {
      return this.policiesService.listForCustomer(tid, cid, status);
    }
    return this.policiesService.list(tid);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchPolicyDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.policiesService.patchPolicy(tenantId || DUMMY_TENANT_ID, id, dto);
  }

  @Post('demo')
  async createDemo(
    @Body() body: { customerId: string },
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.policiesService.createDemo(tenantId || DUMMY_TENANT_ID, body.customerId);
  }
}

