import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PatchPolicyDto } from './dto/patch-policy.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get('summary')
  async summary(
    @CurrentTenant() tenantId: string,
    @Query('windowDays') windowDays?: string,
  ) {
    const w = windowDays ? Number.parseInt(windowDays, 10) : 30;
    const days = Number.isFinite(w) && w > 0 && w <= 365 ? w : 30;
    return this.policiesService.summary(tenantId, days);
  }

  @Get()
  async list(
    @CurrentTenant() tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    const cid = customerId?.trim();
    if (cid) {
      return this.policiesService.listForCustomer(tenantId, cid, status);
    }
    return this.policiesService.list(tenantId);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchPolicyDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.policiesService.patchPolicy(tenantId, id, dto);
  }

  @Post('demo')
  async createDemo(
    @Body() body: { customerId: string },
    @CurrentTenant() tenantId: string,
  ) {
    return this.policiesService.createDemo(tenantId, body.customerId);
  }
}
