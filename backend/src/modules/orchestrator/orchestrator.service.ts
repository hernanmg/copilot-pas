import { Inject, Injectable } from '@nestjs/common';
import type { OrchestratorChannel } from './dto/orchestrator-chat.dto';
import { RAG_SERVICE } from '../rag/contracts/rag.contracts';
import type { IRagService, RagScope, RetrievedChunk } from '../rag/contracts/rag.contracts';
import { LlmService } from './llm.service';

export type OrchestratorAgent =
  | 'COMMERCIAL'
  | 'SUPPORT'
  | 'POLICY_ANALYST'
  | 'CLAIMS'
  | 'ADMIN';

export type OrchestratorIntent =
  | 'sales'
  | 'support'
  | 'policy_analysis'
  | 'claim_intake'
  | 'admin'
  | 'unknown';

export interface OrchestratorChatInput {
  tenantId: string;
  channel: OrchestratorChannel;
  message: string;
  customerId?: string;
}

export interface OrchestratorChatResponse {
  traceId: string;
  tenantId: string;
  channel: OrchestratorChannel;
  intent: OrchestratorIntent;
  agent: OrchestratorAgent;
  draftMessages: string[];
  suggestedNextQuestions: string[];
  rag?: {
    chunks: RetrievedChunk[];
    latencyMs: number;
  };
}

@Injectable()
export class OrchestratorService {
  constructor(
    @Inject(RAG_SERVICE) private readonly ragService: IRagService,
    private readonly llm: LlmService,
  ) {}

  async chat(input: OrchestratorChatInput): Promise<OrchestratorChatResponse> {
    const traceId = `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 1. Classify — LLM with keyword fallback built into LlmService
    const { intent, agent } = await this.llm.classifyIntent(input.message);

    // 2. RAG — same conditional logic as before
    let rag: { chunks: RetrievedChunk[]; latencyMs: number } | undefined;

    if (intent === 'policy_analysis' || intent === 'support') {
      const primaryScopes: RagScope[] =
        intent === 'policy_analysis'
          ? ['POLICY_DOCUMENT', 'INSURER_CONDITIONS']
          : ['FAQ', 'PLAYBOOK', 'GENERIC_KB'];

      let ragResult = await this.ragService.retrieve({
        traceId,
        query: input.message,
        filters: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          scopes: primaryScopes,
        },
        topK: 6,
        minScore: 0.25,
        audit: { actorType: 'AI', skipPersistence: false },
      });

      // Fallback MVP: ampliar scopes si no hay chunks indexados para policy_analysis
      if (intent === 'policy_analysis' && ragResult.chunks.length === 0) {
        ragResult = await this.ragService.retrieve({
          traceId,
          query: input.message,
          filters: {
            tenantId: input.tenantId,
            customerId: input.customerId,
            scopes: ['FAQ', 'PLAYBOOK', 'GENERIC_KB', 'POLICY_DOCUMENT', 'INSURER_CONDITIONS'],
          },
          topK: 6,
          minScore: 0.25,
          audit: { actorType: 'AI', skipPersistence: false },
        });
      }

      rag = { chunks: ragResult.chunks, latencyMs: ragResult.latencyMs };
    }

    // 3. Generate — LLM with RAG context; static fallback built into LlmService
    const { draftMessages, suggestedNextQuestions } = await this.llm.generateResponse(
      input.message,
      agent,
      rag?.chunks ?? [],
    );

    return {
      traceId,
      tenantId: input.tenantId,
      channel: input.channel,
      intent,
      agent,
      draftMessages,
      suggestedNextQuestions,
      rag,
    };
  }
}
