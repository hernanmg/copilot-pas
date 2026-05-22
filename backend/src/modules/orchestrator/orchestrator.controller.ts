import { Body, Controller, Post } from '@nestjs/common';
import { OrchestratorChatDto } from './dto/orchestrator-chat.dto';
import { OrchestratorService } from './orchestrator.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Public()
  @Post('whatsapp/webhook')
  async handleWhatsappWebhook(@Body() payload: any) {
    // Stub: webhook externo no porta JWT; autenticación vía signature pendiente.
    return { received: true, payload };
  }

  @Post('chat')
  async chat(
    @Body() dto: OrchestratorChatDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.orchestratorService.chat({
      tenantId,
      channel: dto.channel || 'WEB',
      message: dto.message,
      customerId: dto.customerId,
    });
  }
}
