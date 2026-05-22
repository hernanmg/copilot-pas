import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import type { RetrievedChunk } from '../rag/contracts/rag.contracts';

// ---------------------------------------------------------------------------
// Public types — compatible with the union aliases in orchestrator.service.ts
// ---------------------------------------------------------------------------

export type ClassifiedIntent = {
  intent: 'sales' | 'support' | 'policy_analysis' | 'claim_intake' | 'admin' | 'unknown';
  agent: 'COMMERCIAL' | 'SUPPORT' | 'POLICY_ANALYST' | 'CLAIMS' | 'ADMIN';
};

export type GeneratedResponse = {
  draftMessages: string[];
  suggestedNextQuestions: string[];
};

type Agent = ClassifiedIntent['agent'];

// ---------------------------------------------------------------------------
// Validation sets for defensive parsing
// ---------------------------------------------------------------------------

const VALID_INTENTS = new Set<string>([
  'sales', 'support', 'policy_analysis', 'claim_intake', 'admin', 'unknown',
]);
const VALID_AGENTS = new Set<string>([
  'COMMERCIAL', 'SUPPORT', 'POLICY_ANALYST', 'CLAIMS', 'ADMIN',
]);

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const CLASSIFY_SYSTEM = `\
Sos un clasificador de intenciones para Copilot Seguros, un copilot para productores asesores de \
seguros argentinos (PAS).

Clasificá el mensaje en exactamente uno de estos intents y asignale el agente correspondiente:

intent            | cuándo usarlo                                                             | agent
------------------|---------------------------------------------------------------------------|----------------
claim_intake      | el usuario reporta o consulta sobre un siniestro, accidente, robo o daño  | CLAIMS
policy_analysis   | consulta sobre cobertura, condiciones, póliza, suma asegurada, vigencia   | POLICY_ANALYST
sales             | cotización, precio, nuevo seguro, contratación                            | COMMERCIAL
admin             | gestión de usuarios, configuración, acceso al sistema                     | ADMIN
support           | cualquier otra consulta, seguimiento, dudas generales                     | SUPPORT
unknown           | mensaje vacío o completamente incomprensible                              | SUPPORT

Reglas:
- Si el mensaje mezcla intents, elegí el más urgente: claim > policy > sales > admin > support.
- Respondé SOLO con JSON válido, sin texto adicional.

Formato exacto: {"intent":"<intent>","agent":"<agent>"}`;

const AGENT_SYSTEMS: Record<Agent, string> = {
  CLAIMS: `\
Sos el asistente de siniestros del productor de seguros. Tu objetivo es ayudar al productor a \
relevar rápidamente los datos clave del hecho para iniciar el trámite.

Si hay contexto indexado, usalo para complementar la respuesta (ej: condiciones de cobertura \
relevantes al tipo de siniestro reportado).

Generá:
- draftMessages: 1 o 2 mensajes que el PRODUCTOR puede enviar al ASEGURADO para recopilar \
información del siniestro. Tono empático y profesional, en español rioplatense.
- suggestedNextQuestions: 3 o 4 preguntas concretas para el seguimiento inmediato.

Respondé SOLO con JSON válido:
{"draftMessages":["...","..."],"suggestedNextQuestions":["...","...","...","..."]}`,

  POLICY_ANALYST: `\
Sos el analista de pólizas del productor. Ayudás a resolver dudas de cobertura con precisión.

Si hay contexto indexado, basate en él para responder. Citá o parafraseá el contexto cuando \
corresponda. Si no hay contexto, invitá al asegurado a compartir la póliza o especificar la duda.

Generá:
- draftMessages: 1 o 2 mensajes que el PRODUCTOR puede enviar al ASEGURADO. Tono técnico pero claro.
- suggestedNextQuestions: 3 o 4 preguntas para clarificar o profundizar la consulta.

Respondé SOLO con JSON válido:
{"draftMessages":["...","..."],"suggestedNextQuestions":["...","...","...","..."]}`,

  COMMERCIAL: `\
Sos el asistente comercial del productor. Ayudás a avanzar en cotizaciones y nuevas contrataciones.

Generá:
- draftMessages: 1 o 2 mensajes que el PRODUCTOR puede enviar al PROSPECTO para avanzar en la \
cotización. Tono proactivo y comercial, en español rioplatense.
- suggestedNextQuestions: 3 o 4 preguntas para calificar el riesgo mínimo necesario para cotizar.

Respondé SOLO con JSON válido:
{"draftMessages":["...","..."],"suggestedNextQuestions":["...","...","...","..."]}`,

  SUPPORT: `\
Sos el asistente de soporte del productor. Respondés consultas generales aprovechando el \
knowledge base disponible.

Si hay contexto indexado, citalo o usalo para fundamentar la respuesta.

Generá:
- draftMessages: 1 mensaje útil y orientativo que el PRODUCTOR puede compartir o usar como guía.
- suggestedNextQuestions: 3 o 4 preguntas o acciones sugeridas para avanzar.

Respondé SOLO con JSON válido:
{"draftMessages":["..."],"suggestedNextQuestions":["...","...","...","..."]}`,

  ADMIN: `\
Sos el asistente de administración del productor. Ayudás con configuración, usuarios y acceso \
al sistema.

Generá:
- draftMessages: 1 mensaje orientativo sobre la acción a realizar.
- suggestedNextQuestions: 2 o 3 preguntas para precisar la necesidad administrativa.

Respondé SOLO con JSON válido:
{"draftMessages":["..."],"suggestedNextQuestions":["...","...","..."]}`,
};

// ---------------------------------------------------------------------------
// Static fallbacks — used when no LLM is configured or any call fails
// ---------------------------------------------------------------------------

const FALLBACK_DRAFTS: Record<Agent, string[]> = {
  CLAIMS: [
    'Lamento lo que pasó. Para ayudarte rápido: ¿hubo heridos? ¿Cuándo y dónde fue el hecho?',
    '¿Podés mandarme fotos del daño y, si es auto, patente y compañía/numero de póliza?',
  ],
  POLICY_ANALYST: [
    'Perfecto. ¿Querés que revise una póliza puntual (PDF) o una duda de cobertura específica?',
    'Decime compañía y número de póliza, o pegá el texto relevante y lo analizo.',
  ],
  COMMERCIAL: [
    'Dale, te ayudo a cotizar. ¿Para qué tipo de seguro es (auto/hogar/vida) y en qué localidad?',
    'Para auto: pasame dominio, año/modelo y uso (particular/comercial).',
  ],
  SUPPORT: ['Entendido. Contame un poco más de lo que necesitás y te propongo el próximo paso.'],
  ADMIN: ['Entendido. ¿Qué acción necesitás realizar en el sistema?'],
};

const FALLBACK_QUESTIONS: Record<Agent, string[]> = {
  CLAIMS: ['¿Hubo heridos?', '¿Cuándo ocurrió?', '¿Dónde ocurrió?', '¿Tenés denuncia/presupuesto/fotos?'],
  COMMERCIAL: ['¿Qué producto buscás?', '¿Localidad?', '¿Datos mínimos del riesgo?'],
  POLICY_ANALYST: ['¿Qué cobertura querés validar?', '¿Compañía y número?', '¿Vigencia y suma asegurada?'],
  SUPPORT: ['¿Cuál es el objetivo?', '¿Qué datos ya tenés?', '¿Qué canal preferís (WhatsApp/Web)?'],
  ADMIN: ['¿Qué usuario o permiso necesitás gestionar?', '¿Es urgente?', '¿Tenés acceso actual al sistema?'],
};

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------

type ChatMessage = { role: string; content: string };

interface LlmCaller {
  call(messages: ChatMessage[]): Promise<string>;
}

function makeOpenAiCaller(
  apiKey: string,
  modelName: string,
  temperature: number,
  maxTokens?: number,
): LlmCaller {
  const model = new ChatOpenAI({ openAIApiKey: apiKey, modelName, temperature, maxTokens });
  return {
    async call(messages) {
      const res = await model.invoke(messages);
      return typeof res.content === 'string' ? res.content.trim() : '';
    },
  };
}

function makeOllamaCaller(baseUrl: string, model: string): LlmCaller {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  return {
    async call(messages) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
      });
      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content?.trim() ?? '';
    },
  };
}

// Some models wrap JSON in markdown fences — strip them before parsing.
function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly classifyCaller: LlmCaller | null = null;
  private readonly generateCaller: LlmCaller | null = null;

  constructor() {
    const ollamaBase = process.env.OLLAMA_BASE_URL?.trim() || null;
    const openAiKey = process.env.OPENAI_API_KEY?.trim() || null;

    if (ollamaBase) {
      const classifyModelName = process.env.ORCHESTRATOR_CLASSIFY_MODEL ?? 'llama3.2';
      const generateModelName = process.env.ORCHESTRATOR_GENERATE_MODEL ?? 'llama3.2';
      this.classifyCaller = makeOllamaCaller(ollamaBase, classifyModelName);
      this.generateCaller = makeOllamaCaller(ollamaBase, generateModelName);
      this.logger.log(
        `LlmService — provider: Ollama (${ollamaBase}), classify: ${classifyModelName}, generate: ${generateModelName}`,
      );
    } else if (openAiKey) {
      const classifyModelName = process.env.ORCHESTRATOR_CLASSIFY_MODEL ?? 'gpt-4o-mini';
      const generateModelName = process.env.ORCHESTRATOR_GENERATE_MODEL ?? 'gpt-4o';
      this.classifyCaller = makeOpenAiCaller(openAiKey, classifyModelName, 0);
      this.generateCaller = makeOpenAiCaller(openAiKey, generateModelName, 0.4, 600);
      this.logger.log(
        `LlmService — provider: OpenAI, classify: ${classifyModelName}, generate: ${generateModelName}`,
      );
    } else {
      this.logger.warn(
        'Ni OLLAMA_BASE_URL ni OPENAI_API_KEY configurados — LLM deshabilitado, se usa clasificación por keywords.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Keyword fallback (preserves the original intent classification logic)
  // -------------------------------------------------------------------------

  private classifyByKeywords(message: string): ClassifiedIntent {
    const n = message.trim().toLowerCase();

    const intent: ClassifiedIntent['intent'] =
      n.includes('siniestro') || n.includes('choque') || n.includes('robo')
        ? 'claim_intake'
        : n.includes('póliza') || n.includes('poliza') || n.includes('cobertura')
          ? 'policy_analysis'
          : n.includes('cotiz') || n.includes('precio') || n.includes('seguro')
            ? 'sales'
            : n.includes('usuario') || n.includes('admin')
              ? 'admin'
              : n.length > 0
                ? 'support'
                : 'unknown';

    const agent: Agent =
      intent === 'claim_intake'
        ? 'CLAIMS'
        : intent === 'policy_analysis'
          ? 'POLICY_ANALYST'
          : intent === 'sales'
            ? 'COMMERCIAL'
            : intent === 'admin'
              ? 'ADMIN'
              : 'SUPPORT';

    return { intent, agent };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async classifyIntent(message: string): Promise<ClassifiedIntent> {
    if (!this.classifyCaller) return this.classifyByKeywords(message);

    try {
      const raw = await this.classifyCaller.call([
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user', content: message },
      ]);
      const text = stripJsonFences(raw);
      const parsed = JSON.parse(text) as { intent?: unknown; agent?: unknown };

      if (!VALID_INTENTS.has(parsed.intent as string) || !VALID_AGENTS.has(parsed.agent as string)) {
        this.logger.warn(`LLM devolvió intent/agent inesperado: ${text} — fallback a keywords`);
        return this.classifyByKeywords(message);
      }

      return {
        intent: parsed.intent as ClassifiedIntent['intent'],
        agent: parsed.agent as Agent,
      };
    } catch (err) {
      this.logger.warn(`classifyIntent error: ${(err as Error).message} — fallback a keywords`);
      return this.classifyByKeywords(message);
    }
  }

  async generateResponse(
    message: string,
    agent: Agent,
    chunks: RetrievedChunk[],
  ): Promise<GeneratedResponse> {
    if (!this.generateCaller) {
      return {
        draftMessages: FALLBACK_DRAFTS[agent],
        suggestedNextQuestions: FALLBACK_QUESTIONS[agent],
      };
    }

    try {
      const contextBlock =
        chunks.length > 0
          ? `=== Contexto relevante ===\n${chunks
              .map((c, i) => `[${i + 1}] ${c.content}`)
              .join('\n\n')}\n=== Fin contexto ===\n\n`
          : '';

      const raw = await this.generateCaller.call([
        { role: 'system', content: AGENT_SYSTEMS[agent] },
        { role: 'user', content: `${contextBlock}Mensaje: ${message}` },
      ]);
      const text = stripJsonFences(raw);
      const parsed = JSON.parse(text) as {
        draftMessages?: unknown;
        suggestedNextQuestions?: unknown;
      };

      const draftMessages =
        Array.isArray(parsed.draftMessages) && parsed.draftMessages.length > 0
          ? (parsed.draftMessages as unknown[]).filter((m): m is string => typeof m === 'string')
          : FALLBACK_DRAFTS[agent];

      const suggestedNextQuestions =
        Array.isArray(parsed.suggestedNextQuestions) && parsed.suggestedNextQuestions.length > 0
          ? (parsed.suggestedNextQuestions as unknown[]).filter(
              (q): q is string => typeof q === 'string',
            )
          : FALLBACK_QUESTIONS[agent];

      return { draftMessages, suggestedNextQuestions };
    } catch (err) {
      this.logger.warn(
        `generateResponse error: ${(err as Error).message} — fallback a respuestas estáticas`,
      );
      return {
        draftMessages: FALLBACK_DRAFTS[agent],
        suggestedNextQuestions: FALLBACK_QUESTIONS[agent],
      };
    }
  }
}
