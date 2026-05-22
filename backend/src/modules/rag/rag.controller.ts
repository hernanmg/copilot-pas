import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import type { RagIndexDocumentInput, RagRetrieveInput } from './contracts/rag.contracts';

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('stats')
  async stats(@Headers('x-tenant-id') tenantIdHeader?: string) {
    return this.ragService.getStats(tenantIdHeader || DUMMY_TENANT_ID);
  }

  @Post('index')
  async index(
    @Body() input: Omit<RagIndexDocumentInput, 'tenantId'> & { tenantId?: string },
    @Headers('x-tenant-id') tenantIdHeader?: string,
  ) {
    const tenantId = input.tenantId || tenantIdHeader || DUMMY_TENANT_ID;
    return this.ragService.indexDocument({ ...input, tenantId } as RagIndexDocumentInput);
  }

  @Post('retrieve')
  async retrieve(
    @Body() input: RagRetrieveInput,
    @Headers('x-tenant-id') tenantIdHeader?: string,
  ) {
    const tenantId = input.filters?.tenantId || tenantIdHeader || DUMMY_TENANT_ID;
    return this.ragService.retrieve({
      ...input,
      filters: { ...(input.filters || ({} as any)), tenantId },
    });
  }
}

