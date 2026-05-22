import { Inject, Injectable } from '@nestjs/common';
import type { OrchestratorChannel } from './dto/orchestrator-chat.dto';
import { RAG_SERVICE } from '../rag/contracts/rag.contracts';
import type { IRagService, RetrievedChunk, RagScope } from '../rag/contracts/rag.contracts';

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
  constructor(@Inject(RAG_SERVICE) private readonly ragService: IRagService) {}

  async chat(input: OrchestratorChatInput): Promise<OrchestratorChatResponse> {
    const traceId = `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const normalized = input.message.trim().toLowerCase();

    const intent: OrchestratorIntent =
      normalized.includes('siniestro') || normalized.includes('choque') || normalized.includes('robo')
        ? 'claim_intake'
        : normalized.includes('póliza') || normalized.includes('poliza') || normalized.includes('cobertura')
          ? 'policy_analysis'
          : normalized.includes('cotiz') || normalized.includes('precio') || normalized.includes('seguro')
            ? 'sales'
            : normalized.includes('usuario') || normalized.includes('admin')
              ? 'admin'
              : normalized.length > 0
                ? 'support'
                : 'unknown';

    const agent: OrchestratorAgent =
      intent === 'claim_intake'
        ? 'CLAIMS'
        : intent === 'policy_analysis'
          ? 'POLICY_ANALYST'
          : intent === 'sales'
            ? 'COMMERCIAL'
            : intent === 'admin'
              ? 'ADMIN'
              : 'SUPPORT';

    const draftMessages =
      agent === 'CLAIMS'
        ? [
            'Lamento lo que pasó. Para ayudarte rápido: ¿hubo heridos? ¿Cuándo y dónde fue el hecho?',
            '¿Podés mandarme fotos del daño y, si es auto, patente y compañía/numero de póliza?',
          ]
        : agent === 'POLICY_ANALYST'
          ? [
              'Perfecto. ¿Querés que revise una póliza puntual (PDF) o una duda de cobertura específica?',
              'Decime compañía y número de póliza, o pegá el texto relevante y lo analizo.',
            ]
          : agent === 'COMMERCIAL'
            ? [
                'Dale, te ayudo a cotizar. ¿Para qué tipo de seguro es (auto/hogar/vida) y en qué localidad?',
                'Para auto: pasame dominio, año/modelo y uso (particular/comercial).',
              ]
            : [
                'Entendido. Contame un poco más de lo que necesitás y te propongo el próximo paso.',
              ];

    const suggestedNextQuestions =
      agent === 'CLAIMS'
        ? ['¿Hubo heridos?', '¿Cuándo ocurrió?', '¿Dónde ocurrió?', '¿Tenés denuncia/presupuesto/fotos?']
        : agent === 'COMMERCIAL'
          ? ['¿Qué producto buscás?', '¿Localidad?', '¿Datos mínimos del riesgo?']
          : agent === 'POLICY_ANALYST'
            ? ['¿Qué cobertura querés validar?', '¿Compañía y número?', '¿Vigencia y suma asegurada?']
            : ['¿Cuál es el objetivo?', '¿Qué datos ya tenés?', '¿Qué canal preferís (WhatsApp/Web)?'];

    const response: OrchestratorChatResponse = {
      traceId,
      tenantId: input.tenantId,
      channel: input.channel,
      intent,
      agent,
      draftMessages,
      suggestedNextQuestions,
    };

    if (intent === 'policy_analysis' || intent === 'support') {
      const primaryScopes: RagScope[] =
        intent === 'policy_analysis'
          ? ['POLICY_DOCUMENT', 'INSURER_CONDITIONS']
          : ['FAQ', 'PLAYBOOK', 'GENERIC_KB'];

      let rag = await this.ragService.retrieve({
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

      // Fallback MVP: si no hay pólizas/condiciones indexadas, ampliar a KB/FAQ para que siempre haya contexto.
      if (intent === 'policy_analysis' && rag.chunks.length === 0) {
        rag = await this.ragService.retrieve({
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
      response.rag = { chunks: rag.chunks, latencyMs: rag.latencyMs };
    }
    return response;
  }
}

