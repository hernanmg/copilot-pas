/**
 * Contrato del servicio RAG (LangChain + pgvector).
 * Los filtros por tenant son obligatorios en runtime; el orquestador nunca delega al LLM la elección del tenant.
 */

export const RAG_SERVICE = Symbol('RAG_SERVICE');

/** Ámbito del conocimiento indexado (filtrable en retrieval). */
export type RagScope =
  | 'FAQ'
  | 'PLAYBOOK'
  | 'POLICY_DOCUMENT'
  | 'INSURER_CONDITIONS'
  | 'CONVERSATION_SUMMARY'
  | 'CLAIM_NOTE'
  | 'GENERIC_KB';

/** Origen del documento (trazabilidad / auditoría). */
export type RagSourceType =
  | 'FILE_UPLOAD'
  | 'FAQ_SYNC'
  | 'CRM_SYNC'
  | 'INSURER_API'
  | 'MANUAL_NOTE'
  | 'WHATSAPP_EXPORT';

/** Parámetros de chunking; la implementación con LangChain puede ignorar y usar defaults. */
export interface RagChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface RagIndexDocumentInput {
  tenantId: string;
  scope: RagScope;
  sourceType: RagSourceType;
  /** Referencia estable: storage key, id FAQ, etc. */
  sourceRef?: string;
  title?: string;
  locale?: string;
  /** Texto completo a fragmentar e indexar. */
  fullText: string;
  chunking?: RagChunkingOptions;
  /** Ej: text-embedding-3-small (debe coincidir con dimensión de la columna vector en DB). */
  embeddingModel: string;
  embeddingDimensions?: number;
  createdByUserId?: string;
  /** Scope opcional por productor / cliente / póliza (multi-tenant + aislamiento). */
  producerId?: string;
  customerId?: string;
  policyId?: string;
  meta?: Record<string, unknown>;
}

export interface RagIndexDocumentResult {
  documentId: string;
  chunkIds: string[];
  contentSha256: string;
  chunkCount: number;
}

export interface RagRetrieveFilters {
  tenantId: string;
  producerId?: string;
  customerId?: string;
  policyId?: string;
  /** Si se omite, el servicio puede usar todos los scopes permitidos por política del tenant. */
  scopes?: RagScope[];
}

export type RagActorType = 'AI' | 'USER' | 'SYSTEM';

export interface RagRetrieveAudit {
  actorType: RagActorType;
  actorId?: string;
  /** Si true, no persiste query_text_redacted en rag_retrieval_logs. */
  skipPersistence?: boolean;
}

export interface RagRetrieveInput {
  traceId?: string;
  query: string;
  filters: RagRetrieveFilters;
  topK?: number;
  minScore?: number;
  embeddingModel?: string;
  audit?: RagRetrieveAudit;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  scope: RagScope;
  content: string;
  score: number;
  chunkIndex: number;
  documentTitle?: string;
  sourceRef?: string;
  embeddingModel: string;
  meta?: Record<string, unknown>;
}

export interface RagRetrieveResult {
  chunks: RetrievedChunk[];
  usedFilters: RagRetrieveFilters;
  latencyMs: number;
}

export interface IRagService {
  indexDocument(input: RagIndexDocumentInput): Promise<RagIndexDocumentResult>;
  retrieve(input: RagRetrieveInput): Promise<RagRetrieveResult>;
  /**
   * Borrado lógico del documento y sus chunks (embeddings).
   * Debe registrar rag_index_events (SOFT_DELETED).
   */
  softDeleteDocument(
    tenantId: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<void>;
}
