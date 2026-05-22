import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Insurer } from '../insurers/insurer.entity';
import { REDIS } from '../../infra/redis/redis.module';
import { Policy } from '../policies/policy.entity';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { Claim } from './claim.entity';
import { ClaimDraft } from './claim-draft.entity';
import { ClaimEvent } from './claim-event.entity';
import { ClaimIntakeConfig, type ClaimIntakeFieldDefinition, type ClaimIntakeFieldKey } from './claim-intake-config.entity';
import { WorkTask } from '../producer-workflow/work-task.entity';
import type { PatchClaimDto } from './dto/patch-claim.dto';
import type { PatchClaimDraftDto } from './dto/patch-claim-draft.dto';
import type { PutClaimIntakeConfigDto } from './dto/put-claim-intake-config.dto';
import { parseInboundForField, resolvePromptedFieldKey } from './claim-draft-intake-from-chat';

type ClaimIntakeState = {
  sessionId: string;
  step: number;
  tenantId: string;
  customerId?: string;
  policyId?: string;
  type?: string;
  eventDatetime?: string;
  eventLocation?: string;
  narrative?: string;
  createdAt: string;
};

export type ClaimIntakeQuestion = { key: string; label: string; placeholder?: string };

export type ClaimIntakeView = {
  sessionId: string;
  step: number;
  done: boolean;
  title: string;
  questions: ClaimIntakeQuestion[];
  state: Omit<ClaimIntakeState, 'tenantId'>;
};

export type DraftIntakeFromChatResult = {
  draftId: string;
  captured: boolean;
  fieldKey?: string;
  fieldLabel?: string;
  missingFields: string[];
  promptedNext: boolean;
  draft: ClaimDraft;
};

const DEFAULT_INTAKE_FIELDS: ClaimIntakeFieldDefinition[] = [
  { key: 'customerId', label: 'Cliente', placeholder: 'UUID del cliente', required: true },
  { key: 'policyId', label: 'Póliza', placeholder: 'UUID de la póliza', required: true },
  { key: 'type', label: 'Tipo', placeholder: 'AUTO / HOGAR / VIDA / OTRO', required: true },
  {
    key: 'eventDatetime',
    label: 'Fecha y hora',
    placeholder: '2026-04-29T10:30:00-03:00',
    required: true,
  },
  {
    key: 'eventLocation',
    label: 'Lugar',
    placeholder: 'Ciudad / barrio / dirección aproximada',
    required: true,
  },
  { key: 'narrative', label: 'Relato', placeholder: 'Contá en pocas líneas el hecho', required: true },
];

@Injectable()
export class ClaimsService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @InjectRepository(Claim) private readonly claimsRepo: Repository<Claim>,
    @InjectRepository(ClaimDraft) private readonly draftsRepo: Repository<ClaimDraft>,
    @InjectRepository(ClaimEvent) private readonly eventsRepo: Repository<ClaimEvent>,
    @InjectRepository(ClaimIntakeConfig) private readonly intakeConfigRepo: Repository<ClaimIntakeConfig>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Policy) private readonly policiesRepo: Repository<Policy>,
    @InjectRepository(Insurer) private readonly insurersRepo: Repository<Insurer>,
    @InjectRepository(Conversation) private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messagesRepo: Repository<Message>,
    @InjectRepository(WorkTask) private readonly tasksRepo: Repository<WorkTask>,
  ) {}

  async getIntakeConfig(tenantId: string) {
    const cfg = await this.intakeConfigRepo.findOne({ where: { tenantId } });
    return {
      tenantId,
      fields: cfg?.fields?.length ? cfg.fields : DEFAULT_INTAKE_FIELDS,
    };
  }

  async putIntakeConfig(tenantId: string, dto: PutClaimIntakeConfigDto) {
    const normalized = normalizeFields(dto.fields as any);
    let entity = await this.intakeConfigRepo.findOne({ where: { tenantId } });
    if (!entity) {
      entity = this.intakeConfigRepo.create({ tenantId, fields: normalized });
    } else {
      entity.fields = normalized;
    }
    await this.intakeConfigRepo.save(entity);
    return { tenantId, fields: entity.fields };
  }

  async startIntake(tenantId: string, init?: { customerId?: string; policyId?: string }) {
    const sessionId = crypto.randomUUID();
    const fields = await this.loadIntakeFields(tenantId);
    const state: ClaimIntakeState = {
      sessionId,
      step: nextStepFromFields(fields, {
        customerId: init?.customerId,
        policyId: init?.policyId,
      }),
      tenantId,
      customerId: init?.customerId,
      policyId: init?.policyId,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(this.key(tenantId, sessionId), JSON.stringify(state), 'EX', 60 * 60 * 24);
    return this.view(fields, state);
  }

  async getIntake(tenantId: string, sessionId: string) {
    const state = await this.load(tenantId, sessionId);
    const fields = await this.loadIntakeFields(tenantId);
    return this.view(fields, state);
  }

  async submitIntakeStep(
    tenantId: string,
    sessionId: string,
    patch: Partial<ClaimIntakeState>,
  ) {
    const state = await this.load(tenantId, sessionId);
    const fields = await this.loadIntakeFields(tenantId);
    const next = { ...state, ...sanitizePatch(patch), tenantId } as ClaimIntakeState;

    next.step = nextStepFromFields(fields, next);
    await this.redis.set(this.key(tenantId, sessionId), JSON.stringify(next), 'EX', 60 * 60 * 24);
    return this.view(fields, next);
  }

  async completeIntake(tenantId: string, sessionId: string) {
    const state = await this.load(tenantId, sessionId);
    const fields = await this.loadIntakeFields(tenantId);
    const requiredMissing = missingRequired(fields, state);
    if (requiredMissing.length > 0) {
      throw new BadRequestException(`Faltan campos para completar: ${requiredMissing.join(', ')}`);
    }

    const entity = this.claimsRepo.create({
      tenantId,
      policyId: state.policyId!,
      customerId: state.customerId!,
      type: state.type!,
      status: 'DRAFT',
      eventDatetime: new Date(state.eventDatetime!),
      eventLocation: state.eventLocation!,
      narrative: state.narrative!,
      requiresHumanReview: false,
    });
    const saved = await this.claimsRepo.save(entity);
    await this.redis.del(this.key(tenantId, sessionId));
    await this.appendEvent(saved.id, 'CREATED', {
      status: saved.status,
      type: saved.type,
    });
    return saved;
  }

  async createDraftFromConversation(tenantId: string, conversationId: string) {
    const conv = await this.conversationsRepo.findOne({
      where: { id: conversationId, tenant: { id: tenantId } as any },
      relations: { customer: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const msgs = await this.messagesRepo.find({
      where: { conversation: { id: conversationId } as any },
      order: { createdAt: 'ASC' },
      take: 200,
    });

    const extracted = extractFromMessages(msgs);
    const resolvedCustomerId = conv.customer?.id ?? extracted.customerId ?? null;
    const autoPolicyId =
      extracted.policyId ??
      (resolvedCustomerId ? await this.autopickSingleActivePolicyId(tenantId, resolvedCustomerId) : null);
    const draft = this.draftsRepo.create({
      tenantId,
      sourceConversationId: conversationId,
      customerId: resolvedCustomerId,
      policyId: autoPolicyId,
      type: extracted.type ?? null,
      eventDatetime: extracted.eventDatetime ? new Date(extracted.eventDatetime) : null,
      eventLocation: extracted.eventLocation ?? null,
      narrative: extracted.narrative ?? buildNarrativeFallback(msgs) ?? null,
      extractedPayload: extracted.raw,
      status: 'DRAFT',
    });

    const fields = await this.loadIntakeFields(tenantId);
    draft.missingFields = missingRequired(fields, draftToState(draft));
    const saved = await this.draftsRepo.save(draft);
    await this.syncDraftTask(tenantId, saved);
    return saved;
  }

  listDrafts(tenantId: string) {
    return this.draftsRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
  }

  async getDraft(tenantId: string, draftId: string) {
    const draft = await this.draftsRepo.findOne({ where: { id: draftId, tenantId } });
    if (!draft) throw new NotFoundException('Borrador de siniestro no encontrado');
    return draft;
  }

  async patchDraft(tenantId: string, draftId: string, dto: PatchClaimDraftDto) {
    const draft = await this.draftsRepo.findOne({ where: { id: draftId, tenantId } });
    if (!draft) throw new NotFoundException('Borrador de siniestro no encontrado');
    if (draft.status !== 'DRAFT') throw new BadRequestException('El borrador no está editable');

    if (dto.customerId !== undefined) {
      draft.customerId = dto.customerId;
      // Si el usuario elige cliente y no tocó policyId, intentamos autopick.
      if (dto.policyId === undefined && (!draft.policyId || draft.policyId.trim() === '')) {
        draft.policyId = dto.customerId
          ? await this.autopickSingleActivePolicyId(tenantId, dto.customerId)
          : null;
      }
    }
    if (dto.policyId !== undefined) draft.policyId = dto.policyId;
    if (dto.type !== undefined) draft.type = dto.type;
    if (dto.eventDatetime !== undefined) {
      const parsed = new Date(dto.eventDatetime);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('eventDatetime inválida');
      }
      draft.eventDatetime = parsed;
    }
    if (dto.eventLocation !== undefined) draft.eventLocation = dto.eventLocation;
    if (dto.narrative !== undefined) draft.narrative = dto.narrative;

    const fields = await this.loadIntakeFields(tenantId);
    draft.missingFields = missingRequired(fields, draftToState(draft));
    const saved = await this.draftsRepo.save(draft);
    await this.syncDraftTask(tenantId, saved);
    return saved;
  }

  async getActiveDraftForConversation(tenantId: string, conversationId: string): Promise<ClaimDraft | null> {
    return this.draftsRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.sourceConversationId = :conversationId', { conversationId })
      .andWhere('d.status = :status', { status: 'DRAFT' })
      .orderBy('d.updatedAt', 'DESC')
      .getOne();
  }

  async processInboundMessageIntake(
    tenantId: string,
    conversationId: string,
    inboundText: string,
  ): Promise<DraftIntakeFromChatResult | null> {
    const draft = await this.getActiveDraftForConversation(tenantId, conversationId);
    if (!draft) return null;

    const fields = await this.loadIntakeFields(tenantId);
    const missing = missingRequired(fields, draftToState(draft));
    if (missing.length === 0) {
      return {
        draftId: draft.id,
        captured: false,
        missingFields: [],
        promptedNext: false,
        draft,
      };
    }

    const msgs = await this.messagesRepo.find({
      where: { conversation: { id: conversationId } as any },
      order: { createdAt: 'ASC' },
      take: 200,
    });

    const prompted = resolvePromptedFieldKey(msgs);
    const fieldKey = (
      prompted && missing.includes(prompted) ? prompted : missing[0]
    ) as ClaimIntakeFieldKey;
    const def =
      fields.find((f) => f.key === fieldKey) ?? { key: fieldKey, label: fieldKey, required: true };

    let parsed = parseInboundForField(fieldKey, inboundText);
    if (fieldKey === 'policyId' && !parsed) {
      parsed = await this.resolvePolicyIdFromText(tenantId, draft.customerId ?? null, inboundText);
    }

    let saved = draft;
    let captured = false;
    if (parsed) {
      saved = await this.applyDraftField(tenantId, draft, fieldKey, parsed);
      captured = true;
    }

    const postMissing = missingRequired(fields, draftToState(saved));
    const promptedNext =
      postMissing.length > 0
        ? await this.promptNextDraftQuestionInternal(tenantId, saved, fields, postMissing)
        : false;
    if (!captured) {
      await this.syncDraftTask(tenantId, saved);
    }

    return {
      draftId: saved.id,
      captured,
      fieldKey: captured ? fieldKey : undefined,
      fieldLabel: captured ? def.label : undefined,
      missingFields: postMissing,
      promptedNext,
      draft: saved,
    };
  }

  async approveDraft(tenantId: string, draftId: string) {
    const draft = await this.draftsRepo.findOne({ where: { id: draftId, tenantId } });
    if (!draft) throw new NotFoundException('Borrador de siniestro no encontrado');
    if (draft.status !== 'DRAFT') throw new BadRequestException('El borrador no está en estado DRAFT');

    const fields = await this.loadIntakeFields(tenantId);
    await this.assertDraftApprovable(tenantId, draft, fields);

    const claim = this.claimsRepo.create({
      tenantId,
      policyId: draft.policyId!,
      customerId: draft.customerId!,
      type: draft.type!,
      status: 'DRAFT',
      eventDatetime: draft.eventDatetime ?? undefined,
      eventLocation: draft.eventLocation ?? undefined,
      narrative: draft.narrative ?? undefined,
      requiresHumanReview: false,
    });
    const saved = await this.claimsRepo.save(claim);
    await this.appendEvent(saved.id, 'CREATED_FROM_DRAFT', {
      draftId: draft.id,
      sourceConversationId: draft.sourceConversationId ?? null,
    });

    draft.status = 'CONVERTED';
    draft.convertedClaimId = saved.id;
    draft.missingFields = [];
    await this.draftsRepo.save(draft);
    await this.syncDraftTask(tenantId, draft);

    return { claim: saved, draft };
  }

  async promptNextDraftQuestion(tenantId: string, draftId: string) {
    const draft = await this.draftsRepo.findOne({ where: { id: draftId, tenantId } });
    if (!draft) throw new NotFoundException('Borrador de siniestro no encontrado');
    if (!draft.sourceConversationId) {
      throw new BadRequestException('Este borrador no está vinculado a una conversación');
    }

    const fields = await this.loadIntakeFields(tenantId);
    const missing = missingRequired(fields, draftToState(draft));
    if (missing.length === 0) {
      throw new BadRequestException('El borrador ya tiene todos los campos requeridos');
    }

    const nextKey = missing[0] as ClaimIntakeFieldKey;
    const def = fields.find((f) => f.key === nextKey) ?? { key: nextKey, label: nextKey, required: true };
    const savedMsg = await this.sendIntakePrompt(draft, def);
    return { draftId: draft.id, field: def, message: savedMsg };
  }

  listClaims(tenantId: string): Promise<Claim[]> {
    return this.claimsRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getClaim(tenantId: string, claimId: string): Promise<Claim> {
    const claim = await this.claimsRepo.findOne({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  async getClaimDetail(tenantId: string, claimId: string) {
    const claim = await this.claimsRepo.findOne({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException('Siniestro no encontrado');
    const events = await this.eventsRepo.find({
      where: { claimId },
      order: { createdAt: 'ASC' },
    });
    const customer = await this.customersRepo.findOne({
      where: { id: claim.customerId, tenant: { id: tenantId } as { id: string } },
    });

    const policy = await this.policiesRepo.findOne({
      where: { id: claim.policyId, tenantId },
    });
    const insurer = policy?.insurerId
      ? await this.insurersRepo.findOne({ where: { id: policy.insurerId, tenantId } })
      : null;

    return {
      claim,
      events,
      policy: policy
        ? {
            id: policy.id,
            policyNumber: policy.policyNumber,
            status: policy.status,
            startDate: policy.startDate,
            endDate: policy.endDate,
            insurerId: policy.insurerId ?? null,
          }
        : null,
      insurer: insurer
        ? {
            id: insurer.id,
            name: insurer.name,
            code: insurer.code,
          }
        : null,
      customer: customer
        ? {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            phoneWhatsapp: customer.phoneWhatsapp,
          }
        : null,
    };
  }

  async patchClaim(tenantId: string, claimId: string, dto: PatchClaimDto): Promise<Claim> {
    const claim = await this.claimsRepo.findOne({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException('Siniestro no encontrado');

    const prevStatus = claim.status;
    const prevReview = claim.requiresHumanReview;
    if (dto.status !== undefined) claim.status = dto.status;
    if (dto.requiresHumanReview !== undefined) claim.requiresHumanReview = dto.requiresHumanReview;

    const saved = await this.claimsRepo.save(claim);

    if (dto.status !== undefined && dto.status !== prevStatus) {
      await this.appendEvent(saved.id, 'STATUS_CHANGED', {
        from: prevStatus,
        to: dto.status,
      });
    }
    if (
      dto.requiresHumanReview !== undefined &&
      dto.requiresHumanReview !== prevReview
    ) {
      await this.appendEvent(saved.id, 'REVIEW_TOGGLED', {
        requiresHumanReview: saved.requiresHumanReview,
      });
    }

    return saved;
  }

  private async appendEvent(claimId: string, type: string, payload: Record<string, unknown>) {
    const ev = this.eventsRepo.create({
      claimId,
      type,
      payload,
    });
    await this.eventsRepo.save(ev);
  }

  private key(tenantId: string, sessionId: string) {
    return `claim_intake:${tenantId}:${sessionId}`;
  }

  private async load(tenantId: string, sessionId: string): Promise<ClaimIntakeState> {
    const raw = await this.redis.get(this.key(tenantId, sessionId));
    if (!raw) throw new NotFoundException('Claim intake session not found');
    const state = JSON.parse(raw) as ClaimIntakeState;
    return state;
  }

  private view(fields: ClaimIntakeFieldDefinition[], state: ClaimIntakeState): ClaimIntakeView {
    const done = nextStepFromFields(fields, state) === 99;
    const questions = questionsForStep(fields, state.step);
    return {
      sessionId: state.sessionId,
      step: state.step,
      done,
      title: titleForStep(fields, state.step, done),
      questions,
      state: omitTenant(state),
    };
  }

  private async loadIntakeFields(tenantId: string): Promise<ClaimIntakeFieldDefinition[]> {
    const cfg = await this.intakeConfigRepo.findOne({ where: { tenantId } });
    if (cfg?.fields?.length) return normalizeFields(cfg.fields);
    return DEFAULT_INTAKE_FIELDS;
  }

  /**
   * Si el cliente tiene exactamente 1 póliza ACTIVE, devolvemos su ID para autocompletar.
   * Si tiene 0 o >1, devolvemos null (evitamos elegir mal).
   */
  private async autopickSingleActivePolicyId(tenantId: string, customerId: string): Promise<string | null> {
    const rows = await this.policiesRepo.find({
      where: { tenantId, customerId, status: 'ACTIVE' },
      order: { createdAt: 'DESC' },
      take: 2,
    });
    if (rows.length === 1) return rows[0].id;
    return null;
  }

  private async resolvePolicyIdFromText(
    tenantId: string,
    customerId: string | null,
    text: string,
  ): Promise<string | null> {
    const candidate = text.trim();
    if (!candidate) return null;
    const where: { tenantId: string; policyNumber: string; customerId?: string } = {
      tenantId,
      policyNumber: candidate,
    };
    if (customerId) where.customerId = customerId;
    const byNumber = await this.policiesRepo.findOne({ where });
    if (byNumber) return byNumber.id;

    const qb = this.policiesRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(p.policyNumber) = LOWER(:candidate)', { candidate });
    if (customerId) qb.andWhere('p.customerId = :customerId', { customerId });
    const byCase = await qb.getOne();
    return byCase?.id ?? null;
  }

  private async assertDraftApprovable(
    tenantId: string,
    draft: ClaimDraft,
    fields: ClaimIntakeFieldDefinition[],
  ): Promise<void> {
    const missing = missingRequired(fields, draftToState(draft));
    if (missing.length > 0) {
      throw new BadRequestException(`Faltan campos para aprobar: ${missing.join(', ')}`);
    }

    const customerId = draft.customerId?.trim();
    if (!customerId) throw new BadRequestException('Falta cliente en el borrador');

    const customer = await this.customersRepo.findOne({
      where: { id: customerId, tenant: { id: tenantId } as any },
    });
    if (!customer) throw new BadRequestException('Cliente inexistente o de otro tenant');

    const policyId = draft.policyId?.trim();
    if (!policyId) {
      const activeCount = await this.policiesRepo.count({
        where: { tenantId, customerId, status: 'ACTIVE' },
      });
      if (activeCount > 1) {
        throw new BadRequestException(
          'El cliente tiene varias pólizas activas; elegí una póliza explícitamente.',
        );
      }
      throw new BadRequestException('Falta póliza en el borrador');
    }

    const policy = await this.policiesRepo.findOne({ where: { id: policyId, tenantId } });
    if (!policy) throw new BadRequestException('Póliza inexistente');
    if (policy.customerId !== customerId) {
      throw new BadRequestException('La póliza no pertenece al cliente del borrador');
    }
    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException('La póliza debe estar ACTIVE para crear el siniestro');
    }

    const typ = (draft.type ?? '').trim().toUpperCase();
    if (!['AUTO', 'HOGAR', 'VIDA', 'OTRO'].includes(typ)) {
      throw new BadRequestException('Tipo de siniestro inválido');
    }

    if (!draft.eventDatetime) throw new BadRequestException('Falta fecha del hecho');
    if (draft.eventDatetime.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('La fecha del hecho no puede estar en el futuro');
    }

    const location = (draft.eventLocation ?? '').trim();
    if (!location) throw new BadRequestException('Falta lugar del hecho');

    const narrative = (draft.narrative ?? '').trim();
    if (narrative.length < 3) throw new BadRequestException('Relato demasiado corto o ausente');
  }

  private async applyDraftField(
    tenantId: string,
    draft: ClaimDraft,
    fieldKey: ClaimIntakeFieldKey,
    value: string,
  ): Promise<ClaimDraft> {
    switch (fieldKey) {
      case 'customerId':
        draft.customerId = value;
        if (!draft.policyId || draft.policyId.trim() === '') {
          draft.policyId = await this.autopickSingleActivePolicyId(tenantId, value);
        }
        break;
      case 'policyId':
        draft.policyId = value;
        break;
      case 'type':
        draft.type = value;
        break;
      case 'eventDatetime':
        draft.eventDatetime = new Date(value);
        break;
      case 'eventLocation':
        draft.eventLocation = value;
        break;
      case 'narrative':
        draft.narrative = value;
        break;
    }

    const fields = await this.loadIntakeFields(tenantId);
    draft.missingFields = missingRequired(fields, draftToState(draft));
    const saved = await this.draftsRepo.save(draft);
    await this.syncDraftTask(tenantId, saved);
    return saved;
  }

  private async sendIntakePrompt(draft: ClaimDraft, def: ClaimIntakeFieldDefinition): Promise<Message> {
    const question = await this.buildIntakeQuestionText(draft.tenantId, draft, def);
    const msg = this.messagesRepo.create({
      conversation: { id: draft.sourceConversationId! } as any,
      direction: 'OUTBOUND',
      senderType: 'AI',
      text: question,
      rawPayload: {
        kind: 'CLAIM_INTAKE_PROMPT',
        draftId: draft.id,
        fieldKey: def.key,
      },
    });
    const savedMsg = await this.messagesRepo.save(msg);
    await this.conversationsRepo.update(
      { id: draft.sourceConversationId! } as any,
      { updatedAt: new Date() } as any,
    );
    return savedMsg;
  }

  private async buildIntakeQuestionText(
    tenantId: string,
    draft: ClaimDraft,
    def: ClaimIntakeFieldDefinition,
  ): Promise<string> {
    let question = buildQuestionForField(def);
    if (def.key !== 'policyId' || !draft.customerId) return question;

    const policies = await this.policiesRepo.find({
      where: { tenantId, customerId: draft.customerId, status: 'ACTIVE' },
      order: { policyNumber: 'ASC' },
      take: 10,
    });
    if (policies.length > 1) {
      const list = policies.map((p) => p.policyNumber).join(', ');
      question += ` Tenemos estas pólizas activas: ${list}. Respondé con el número de póliza.`;
    } else if (policies.length === 1) {
      question += ` (Tenés una póliza activa: ${policies[0].policyNumber}).`;
    }
    return question;
  }

  private async promptNextDraftQuestionInternal(
    tenantId: string,
    draft: ClaimDraft,
    fields: ClaimIntakeFieldDefinition[],
    missing: string[],
  ): Promise<boolean> {
    if (!draft.sourceConversationId || missing.length === 0) return false;
    const nextKey = missing[0] as ClaimIntakeFieldKey;
    const def = fields.find((f) => f.key === nextKey) ?? { key: nextKey, label: nextKey, required: true };
    await this.sendIntakePrompt(draft, def);
    return true;
  }

  private async syncDraftTask(tenantId: string, draft: ClaimDraft) {
    const missing = (draft.missingFields ?? []).filter(Boolean);
    const relatedEntityType = 'CLAIM_DRAFT';

    const existing = await this.tasksRepo.findOne({
      where: { tenantId, relatedEntityType, relatedEntityId: draft.id, type: 'CLAIM_INTAKE_MISSING' } as any,
    });

    if (draft.status !== 'DRAFT' || missing.length === 0) {
      if (existing && existing.status !== 'DONE' && existing.status !== 'CANCELLED') {
        existing.status = 'DONE';
        existing.description = existing.description ?? null;
        await this.tasksRepo.save(existing);
      }
      return;
    }

    const title = 'Completar intake de siniestro';
    const desc = `Campos faltantes: ${missing.join(', ')}`;
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (existing) {
      existing.status = 'OPEN';
      existing.title = title;
      existing.description = desc;
      existing.dueAt = dueAt;
      await this.tasksRepo.save(existing);
      return;
    }

    const task = this.tasksRepo.create({
      tenantId,
      type: 'CLAIM_INTAKE_MISSING',
      status: 'OPEN',
      relatedEntityType,
      relatedEntityId: draft.id,
      title,
      description: desc,
      dueAt,
    });
    await this.tasksRepo.save(task);
  }
}

function buildQuestionForField(def: ClaimIntakeFieldDefinition): string {
  const base = def.label || def.key;
  const hint = def.placeholder ? ` (ej: ${def.placeholder})` : '';
  return `Para avanzar con el siniestro, necesito ${base}.${hint}`.trim();
}

function omitTenant(s: ClaimIntakeState): Omit<ClaimIntakeState, 'tenantId'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, ...rest } = s;
  return rest;
}

function sanitizePatch(patch: Partial<ClaimIntakeState>): Partial<ClaimIntakeState> {
  const next: Partial<ClaimIntakeState> = {};
  const keys: (keyof ClaimIntakeState)[] = [
    'customerId',
    'policyId',
    'type',
    'eventDatetime',
    'eventLocation',
    'narrative',
  ];
  for (const k of keys) {
    const v = patch[k];
    if (typeof v === 'string' && v.trim().length > 0) (next as any)[k] = v.trim();
  }
  return next;
}

function nextStepFromFields(fields: ClaimIntakeFieldDefinition[], state: Partial<ClaimIntakeState>): number {
  const required = fields.filter((f) => f.required !== false);
  for (let i = 0; i < required.length; i++) {
    const k = required[i].key;
    const v = (state as any)[k];
    if (typeof v !== 'string' || v.trim().length === 0) return i + 1;
  }
  return 99;
}

function missingRequired(fields: ClaimIntakeFieldDefinition[], state: Partial<ClaimIntakeState>): string[] {
  const missing: string[] = [];
  const required = fields.filter((f) => f.required !== false);
  for (const f of required) {
    const v = (state as any)[f.key];
    if (typeof v !== 'string' || v.trim().length === 0) missing.push(f.key);
  }
  return missing;
}

function titleForStep(fields: ClaimIntakeFieldDefinition[], step: number, done: boolean): string {
  if (done) return 'Listo para crear borrador';
  const idx = Math.max(0, step - 1);
  const field = fields.filter((f) => f.required !== false)[idx];
  return field?.label || 'Siniestro';
}

function questionsForStep(fields: ClaimIntakeFieldDefinition[], step: number): ClaimIntakeQuestion[] {
  const idx = Math.max(0, step - 1);
  const field = fields.filter((f) => f.required !== false)[idx];
  if (!field) return [];
  return [{ key: field.key, label: field.label, placeholder: field.placeholder }];
}

function normalizeFields(fields: ClaimIntakeFieldDefinition[]): ClaimIntakeFieldDefinition[] {
  const seen = new Set<string>();
  const out: ClaimIntakeFieldDefinition[] = [];
  for (const f of fields || []) {
    if (!f?.key || seen.has(f.key)) continue;
    seen.add(f.key);
    out.push({
      key: f.key,
      label: String((f as any).label || f.key),
      placeholder: (f as any).placeholder ? String((f as any).placeholder) : undefined,
      required: (f as any).required !== false,
    });
  }
  return out.length ? out : DEFAULT_INTAKE_FIELDS;
}

function draftToState(d: ClaimDraft): Partial<ClaimIntakeState> {
  return {
    customerId: d.customerId ?? undefined,
    policyId: d.policyId ?? undefined,
    type: d.type ?? undefined,
    eventDatetime: d.eventDatetime ? d.eventDatetime.toISOString() : undefined,
    eventLocation: d.eventLocation ?? undefined,
    narrative: d.narrative ?? undefined,
  };
}

function extractFromMessages(msgs: Message[]): {
  customerId?: string;
  policyId?: string;
  type?: string;
  eventDatetime?: string;
  eventLocation?: string;
  narrative?: string;
  raw: Record<string, unknown>;
} {
  const inboundTexts = msgs
    .filter((m) => m.senderType === 'CUSTOMER' && typeof m.text === 'string')
    .map((m) => m.text!.trim())
    .filter(Boolean);

  // Muy básico por ahora: dejar la extracción “abierta” y mejorar con agentes luego.
  return {
    narrative: inboundTexts.slice(-3).join('\n'),
    raw: { inboundCount: inboundTexts.length },
  };
}

function buildNarrativeFallback(msgs: Message[]): string | null {
  const lines = msgs
    .filter((m) => typeof m.text === 'string' && m.text!.trim().length > 0)
    .slice(-10)
    .map((m) => {
      const who = m.senderType === 'CUSTOMER' ? 'Cliente' : m.senderType === 'PRODUCER' ? 'PAS' : 'AI';
      return `${who}: ${m.text!.trim()}`;
    });
  return lines.length ? lines.join('\n') : null;
}
