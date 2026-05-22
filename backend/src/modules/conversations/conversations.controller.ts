import {
  Body,
  Controller,
  Get,
  Headers,
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

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
  ) {
    return this.conversationsService.list(tenantId || DUMMY_TENANT_ID, { status, channel });
  }

  @Post()
  async create(
    @Body() dto: CreateConversationDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    return this.conversationsService.create(tenantId || DUMMY_TENANT_ID, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    return this.conversationsService.update(tenantId || DUMMY_TENANT_ID, id, dto);
  }

  @Get(':id/messages')
  async messages(@Param('id') conversationId: string) {
    return this.conversationsService.messages(conversationId);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    return this.conversationsService.addMessage(
      tenantId || DUMMY_TENANT_ID,
      conversationId,
      dto,
    );
  }
}
