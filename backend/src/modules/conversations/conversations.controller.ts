import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
  ) {
    return this.conversationsService.list(tenantId, { status, channel });
  }

  @Post()
  async create(
    @Body() dto: CreateConversationDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.conversationsService.create(tenantId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.conversationsService.update(tenantId, id, dto);
  }

  @Get(':id/messages')
  async messages(@Param('id') conversationId: string) {
    return this.conversationsService.messages(conversationId);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.conversationsService.addMessage(tenantId, conversationId, dto);
  }
}
