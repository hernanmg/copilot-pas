import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial } from 'typeorm';
import { Repository } from 'typeorm';
import { ClaimsService } from '../claims/claims.service';
import { Customer } from '../customers/customer.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import type { DraftIntakeFromChatResult } from '../claims/claims.service';

export type AddMessageResult = {
  message: Message;
  intake: DraftIntakeFromChatResult | null;
};

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepo: Repository<Message>,
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    private readonly claimsService: ClaimsService,
  ) {}

  list(
    tenantId: string,
    filters?: { status?: string; channel?: string },
  ): Promise<Conversation[]> {
    const qb = this.conversationsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.customer', 'customer')
      .where('c.tenant = :tid', { tid: tenantId });
    if (filters?.status?.trim()) {
      qb.andWhere('c.status = :st', { st: filters.status.trim() });
    }
    if (filters?.channel?.trim()) {
      qb.andWhere('c.channel = :ch', { ch: filters.channel.trim() });
    }
    return qb.orderBy('c.updatedAt', 'DESC').take(100).getMany();
  }

  async create(tenantId: string, dto: CreateConversationDto): Promise<Conversation> {
    const partial: DeepPartial<Conversation> = {
      tenant: { id: tenantId } as any,
      channel: dto.channel ?? 'whatsapp',
      topic: dto.topic,
      customer: dto.customerId ? ({ id: dto.customerId } as any) : undefined,
      status: 'OPEN',
    };
    const entity = this.conversationsRepo.create(partial);
    return this.conversationsRepo.save(entity);
  }

  async update(
    tenantId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conv = await this.conversationsRepo.findOne({
      where: { id: conversationId, tenant: { id: tenantId } as any },
      relations: { customer: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    if (dto.topic !== undefined) conv.topic = dto.topic;
    if (dto.status !== undefined) conv.status = dto.status;

    if (dto.customerId !== undefined) {
      if (dto.customerId === null) {
        conv.customer = null as any;
      } else {
        const cust = await this.customersRepo.findOne({
          where: { id: dto.customerId, tenant: { id: tenantId } as any },
        });
        if (!cust) throw new NotFoundException('Cliente no encontrado en este tenant');
        conv.customer = cust;
      }
    }

    return this.conversationsRepo.save(conv);
  }

  messages(conversationId: string): Promise<Message[]> {
    return this.messagesRepo.find({
      where: { conversation: { id: conversationId } as any },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async addMessage(
    tenantId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<AddMessageResult> {
    const conversation = await this.conversationsRepo.findOne({
      where: { id: conversationId, tenant: { id: tenantId } as any },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const partial: DeepPartial<Message> = {
      conversation: { id: conversationId } as any,
      direction: dto.direction,
      senderType: dto.senderType,
      text: dto.text,
    };
    const entity = this.messagesRepo.create(partial);
    const saved = await this.messagesRepo.save(entity);
    await this.conversationsRepo.update(
      { id: conversationId },
      { updatedAt: new Date() } as any,
    );

    let intake = null;
    if (dto.direction === 'INBOUND' && dto.senderType === 'CUSTOMER' && dto.text?.trim()) {
      intake = await this.claimsService.processInboundMessageIntake(
        tenantId,
        conversationId,
        dto.text.trim(),
      );
    }

    return { message: saved, intake };
  }
}
