-- RAG multi-tenant + auditable (pgvector)
-- Requiere imagen Postgres con pgvector (ej. pgvector/pgvector:pg16).

CREATE EXTENSION IF NOT EXISTS vector;

-- Documento lógico indexado (FAQ, playbook, póliza, condiciones, etc.)
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN (
    'FAQ',
    'PLAYBOOK',
    'POLICY_DOCUMENT',
    'INSURER_CONDITIONS',
    'CONVERSATION_SUMMARY',
    'CLAIM_NOTE',
    'GENERIC_KB'
  )),
  source_type TEXT NOT NULL,
  source_ref TEXT,
  title TEXT,
  locale TEXT NOT NULL DEFAULT 'es-AR',
  content_sha256 CHAR(64) NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_tenant_scope
  ON rag_documents (tenant_id, scope)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_tenant_policy
  ON rag_documents (tenant_id, policy_id)
  WHERE deleted_at IS NULL AND policy_id IS NOT NULL;

-- Fragmentos con embedding (un vector por chunk; modelo versionado en columna)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT,
  embedding_model TEXT NOT NULL,
  embedding_dimensions SMALLINT NOT NULL,
  -- IMPORTANTE: esta dimensión debe coincidir con el modelo de embeddings elegido.
  -- OpenAI (text-embedding-3-small): 1536
  -- Ollama (mxbai-embed-large): 1024
  embedding vector(1024) NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

-- Garantizar coherencia tenant_id = documento.tenant_id (trigger)
CREATE OR REPLACE FUNCTION rag_chunks_sync_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id <> (SELECT d.tenant_id FROM rag_documents d WHERE d.id = NEW.document_id) THEN
    RAISE EXCEPTION 'rag_chunks.tenant_id must match rag_documents.tenant_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_chunks_sync_tenant ON rag_chunks;
CREATE TRIGGER trg_rag_chunks_sync_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, document_id ON rag_chunks
  FOR EACH ROW EXECUTE PROCEDURE rag_chunks_sync_tenant();

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks (document_id);

-- Búsqueda por similitud acotada por tenant (IVFFlat o HNSW; HNSW suele ir mejor en prod)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
  ON rag_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Auditoría de indexación / reindex / borrado lógico
CREATE TABLE IF NOT EXISTS rag_index_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'DOCUMENT_CREATED',
    'CHUNKS_WRITTEN',
    'REINDEXED',
    'SOFT_DELETED',
    'HARD_DELETED'
  )),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_index_events_document ON rag_index_events (document_id, created_at DESC);

-- Auditoría de retrieval (sin guardar texto crudo de la consulta si hay PII; usar fingerprint)
CREATE TABLE IF NOT EXISTS rag_retrieval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trace_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('AI', 'USER', 'SYSTEM')),
  actor_id UUID,
  query_fingerprint CHAR(64),
  query_text_redacted TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  top_chunk_ids UUID[] NOT NULL DEFAULT '{}',
  top_scores DOUBLE PRECISION[],
  embedding_model TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_retrieval_logs_tenant_time ON rag_retrieval_logs (tenant_id, created_at DESC);
