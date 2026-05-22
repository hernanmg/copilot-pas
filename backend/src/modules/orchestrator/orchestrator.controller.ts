import { Body, Controller, Headers, Post } from '@nestjs/common';
import { OrchestratorChatDto } from './dto/orchestrator-chat.dto';
import { OrchestratorService } from './orchestrator.service';

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('whatsapp/webhook')
  async handleWhatsappWebhook(@Body() payload: any) {
    // Stub para pruebas locales: solo loguea y responde 200.
    return {
      received: true,
      payload
    };
  }

  @Post('chat')
  async chat(
    @Body() dto: OrchestratorChatDto,
    @Headers('x-tenant-id') tenantIdHeader?: string,
  ) {
    const tenantId =
      dto.tenantId || tenantIdHeader || '00000000-0000-0000-0000-000000000000';
    return this.orchestratorService.chat({
      tenantId,
      channel: dto.channel || 'WEB',
      message: dto.message,
      customerId: dto.customerId,
    });
  }
}

