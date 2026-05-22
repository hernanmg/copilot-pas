import { Body, Controller, Get, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import type { RagIndexDocumentInput, RagRetrieveInput } from './contracts/rag.contracts';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('stats')
  async stats(@CurrentTenant() tenantId: string) {
    return this.ragService.getStats(tenantId);
  }

  @Post('index')
  async index(
    @Body() input: Omit<RagIndexDocumentInput, 'tenantId'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.ragService.indexDocument({ ...input, tenantId } as RagIndexDocumentInput);
  }

  @Post('retrieve')
  async retrieve(
    @Body() input: RagRetrieveInput,
    @CurrentTenant() tenantId: string,
  ) {
    return this.ragService.retrieve({
      ...input,
      filters: { ...(input.filters || ({} as any)), tenantId },
    });
  }
}
