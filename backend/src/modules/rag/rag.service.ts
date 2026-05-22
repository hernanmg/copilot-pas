import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/ollama';
import type {
  IRagService,
  RagIndexDocumentInput,
  RagIndexDocumentResult,
  RagRetrieveInput,
  RagRetrieveResult,
  RetrievedChunk,
} from './contracts/rag.contracts';

/**
 * Stub: conecta aquí LangChain (embeddings + PGVectorStore) y repositorios SQL.
 * retrieve() devuelve vacío; indexDocument() lanza hasta implementar pipeline.
 */
@Injectable()
export class RagService implements IRagService {
  private readonly logger = new Logger(RagService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5433),
      user: process.env.DB_USER || 'copilot',
      password: process.env.DB_PASSWORD || 'copilot_pass',
      database: process.env.DB_NAME || 'copilot_seguros',
    });
  }

  private getEmbeddings(model: string): EmbeddingsLike {
    const provider = (process.env.RAG_EMBEDDINGS_PROVIDER || 'OPENAI').toUpperCase();
    if (provider === 'OLLAMA') {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_EMBED_MODEL || model || 'mxbai-embed-large';
      return new OllamaEmbeddings({ baseUrl, model: ollamaModel });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new NotImplementedException(
        'RAG embeddings provider=OPENAI requiere OPENAI_API_KEY. Alternativa: setear RAG_EMBEDDINGS_PROVIDER=OLLAMA.',
      );
    }
    return new OpenAIEmbeddings({ apiKey, model });
  }

  async indexDocument(input: RagIndexDocumentInput): Promise<RagIndexDocumentResult> {
    const embeddings = this.getEmbeddings(input.embeddingModel);

    const started = Date.now();
    const contentSha256 = createHash('sha256').update(input.fullText, 'utf8').digest('hex');
    const embeddingDimensions =
      input.embeddingDimensions ?? Number(process.env.RAG_EMBEDDING_DIMENSIONS || 1536);

    const chunks = chunkText(input.fullText, {
      chunkSize: input.chunking?.maxTokens ? input.chunking.maxTokens * 4 : 1200,
      overlap: input.chunking?.overlapTokens ? input.chunking.overlapTokens * 4 : 200,
    });

    const vectors = await embeddings.embedDocuments(chunks);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const docRes = await client.query(
        `
        INSERT INTO rag_documents
          (tenant_id, producer_id, customer_id, policy_id, scope, source_type, source_ref, title, locale, content_sha256, meta, created_by_user_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
        RETURNING id
        `,
        [
          input.tenantId,
          input.producerId ?? null,
          input.customerId ?? null,
          input.policyId ?? null,
          input.scope,
          input.sourceType,
          input.sourceRef ?? null,
          input.title ?? null,
          input.locale ?? 'es-AR',
          contentSha256,
          JSON.stringify(input.meta ?? {}),
          input.createdByUserId ?? null,
        ],
      );

      const documentId: string = docRes.rows[0].id;

      await client.query(
        `
        INSERT INTO rag_index_events (tenant_id, document_id, event_type, actor_user_id, details)
        VALUES ($1, $2, 'DOCUMENT_CREATED', $3, $4::jsonb)
        `,
        [input.tenantId, documentId, input.createdByUserId ?? null, JSON.stringify({ sourceType: input.sourceType })],
      );

      const chunkIds: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const vec = vectors[i];
        const embeddingLiteral = toPgVectorLiteral(vec);
        const row = await client.query(
          `
          INSERT INTO rag_chunks
            (tenant_id, document_id, chunk_index, content, token_count, embedding_model, embedding_dimensions, embedding, meta)
          VALUES
            ($1, $2, $3, $4, NULL, $5, $6, $7::vector, $8::jsonb)
          RETURNING id
          `,
          [
            input.tenantId,
            documentId,
            i,
            chunks[i],
            input.embeddingModel,
            embeddingDimensions,
            embeddingLiteral,
            JSON.stringify({}),
          ],
        );
        chunkIds.push(row.rows[0].id);
      }

      await client.query(
        `
        INSERT INTO rag_index_events (tenant_id, document_id, event_type, actor_user_id, details)
        VALUES ($1, $2, 'CHUNKS_WRITTEN', $3, $4::jsonb)
        `,
        [input.tenantId, documentId, input.createdByUserId ?? null, JSON.stringify({ chunkCount: chunks.length })],
      );

      await client.query('COMMIT');
      const latencyMs = Date.now() - started;
      this.logger.log(`indexDocument ok doc=${documentId} chunks=${chunks.length} latencyMs=${latencyMs}`);
      return {
        documentId,
        chunkIds,
        contentSha256,
        chunkCount: chunks.length,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async retrieve(input: RagRetrieveInput): Promise<RagRetrieveResult> {
    const started = Date.now();
    if (!input.filters?.tenantId) {
      this.logger.warn('retrieve() sin tenantId — rechazado a nivel orquestador en prod');
    }
    const provider = (process.env.RAG_EMBEDDINGS_PROVIDER || 'OPENAI').toUpperCase();
    const embeddingModel =
      input.embeddingModel ??
      (provider === 'OLLAMA'
        ? process.env.OLLAMA_EMBED_MODEL
        : process.env.RAG_EMBEDDING_MODEL) ??
      'text-embedding-3-small';
    const embeddings = this.getEmbeddings(embeddingModel);
    const queryVector = await embeddings.embedQuery(input.query);

    const topK = input.topK ?? 8;
    const tenantId = input.filters.tenantId;
    const scopes = input.filters.scopes && input.filters.scopes.length > 0 ? input.filters.scopes : undefined;

    const conditions: string[] = [
      'c.tenant_id = $1',
      'd.deleted_at IS NULL',
    ];
    const params: any[] = [tenantId];
    let p = 2;

    if (scopes) {
      conditions.push(`d.scope = ANY($${p}::text[])`);
      params.push(scopes);
      p++;
    }
    if (input.filters.customerId) {
      conditions.push(`d.customer_id = $${p}`);
      params.push(input.filters.customerId);
      p++;
    }
    if (input.filters.policyId) {
      conditions.push(`d.policy_id = $${p}`);
      params.push(input.filters.policyId);
      p++;
    }

    const embeddingLiteral = toPgVectorLiteral(queryVector);
    conditions.push(`c.embedding_model = $${p}`);
    params.push(embeddingModel);
    p++;

    const sql = `
      SELECT
        c.id AS chunk_id,
        c.document_id AS document_id,
        d.scope AS scope,
        c.content AS content,
        c.chunk_index AS chunk_index,
        d.title AS document_title,
        d.source_ref AS source_ref,
        c.embedding_model AS embedding_model,
        (1 - (c.embedding <=> $${p}::vector)) AS score
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.document_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.embedding <=> $${p}::vector ASC
      LIMIT ${topK}
    `;
    params.push(embeddingLiteral);

    const res = await this.pool.query(sql, params);
    let chunks: RetrievedChunk[] = res.rows.map((r: any) => ({
      chunkId: r.chunk_id as string,
      documentId: r.document_id as string,
      scope: r.scope,
      content: r.content as string,
      score: Number(r.score),
      chunkIndex: Number(r.chunk_index),
      documentTitle: (r.document_title as string | null) ?? undefined,
      sourceRef: (r.source_ref as string | null) ?? undefined,
      embeddingModel: r.embedding_model as string,
    }));

    if (typeof input.minScore === 'number') {
      chunks = chunks.filter((c) => c.score >= input.minScore!);
    }

    const latencyMs = Date.now() - started;
    if (input.audit && !input.audit.skipPersistence) {
      const fp = fingerprintQuery(input.query);
      const topChunkIds = chunks.map((c) => c.chunkId);
      const topScores = chunks.map((c) => c.score);
      await this.pool.query(
        `
        INSERT INTO rag_retrieval_logs
          (tenant_id, trace_id, actor_type, actor_id, query_fingerprint, query_text_redacted, filters, top_chunk_ids, top_scores, embedding_model, latency_ms)
        VALUES
          ($1, $2, $3, $4, $5, NULL, $6::jsonb, $7::uuid[], $8::double precision[], $9, $10)
        `,
        [
          tenantId,
          input.traceId ?? null,
          input.audit.actorType,
          input.audit.actorId ?? null,
          fp,
          JSON.stringify(input.filters),
          topChunkIds,
          topScores,
          embeddingModel,
          latencyMs,
        ],
      );
      this.logger.debug(
        `RAG retrieve trace=${input.traceId ?? '-'} tenant=${tenantId} chunks=${chunks.length} fp=${fp} latencyMs=${latencyMs}`,
      );
    }
    return {
      chunks,
      usedFilters: input.filters,
      latencyMs,
    };
  }

  async softDeleteDocument(
    tenantId: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE rag_documents SET deleted_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2`,
        [documentId, tenantId],
      );
      await client.query(
        `
        INSERT INTO rag_index_events (tenant_id, document_id, event_type, actor_user_id, details)
        VALUES ($1, $2, 'SOFT_DELETED', $3, '{}'::jsonb)
        `,
        [tenantId, documentId, actorUserId ?? null],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Conteos por scope para panel admin (documentos y chunks no borrados). */
  async getStats(tenantId: string): Promise<{
    tenantId: string;
    totalDocuments: number;
    totalChunks: number;
    byScope: { scope: string; documents: number; chunks: number }[];
  }> {
    const docs = await this.pool.query<{ scope: string; count: string }>(
      `
      SELECT scope, COUNT(*)::text AS count
      FROM rag_documents
      WHERE tenant_id = $1 AND deleted_at IS NULL
      GROUP BY scope
      `,
      [tenantId],
    );
    const chunks = await this.pool.query<{ scope: string; count: string }>(
      `
      SELECT d.scope, COUNT(c.id)::text AS count
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.document_id
      WHERE c.tenant_id = $1 AND d.deleted_at IS NULL
      GROUP BY d.scope
      `,
      [tenantId],
    );

    const docMap = new Map(docs.rows.map((r) => [r.scope, Number(r.count)]));
    const chunkMap = new Map(chunks.rows.map((r) => [r.scope, Number(r.count)]));
    const scopes = new Set([...docMap.keys(), ...chunkMap.keys()]);
    const byScope = [...scopes]
      .sort()
      .map((scope) => ({
        scope,
        documents: docMap.get(scope) ?? 0,
        chunks: chunkMap.get(scope) ?? 0,
      }));

    const totalDocuments = [...docMap.values()].reduce((a, b) => a + b, 0);
    const totalChunks = [...chunkMap.values()].reduce((a, b) => a + b, 0);

    return { tenantId, totalDocuments, totalChunks, byScope };
  }
}

export function fingerprintQuery(normalized: string): string {
  return createHash('sha256').update(normalized.trim().toLowerCase(), 'utf8').digest('hex');
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

type EmbeddingsLike = {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

function chunkText(
  text: string,
  opts: { chunkSize: number; overlap: number },
): string[] {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  const chunkSize = Math.max(200, opts.chunkSize);
  const overlap = Math.max(0, Math.min(opts.overlap, chunkSize - 50));

  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkSize);
    const slice = t.slice(i, end);
    chunks.push(slice);
    if (end === t.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}
