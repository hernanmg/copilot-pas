-- Aprobaciones explícitas + seed de tareas SLA (tenant demo).
-- Ejecutar manualmente en DBs ya existentes: psql -f 003-producer-workflow.sql

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  title TEXT NOT NULL,
  reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status ON approval_requests(tenant_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM approval_requests WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  ) THEN
    INSERT INTO approval_requests (tenant_id, kind, status, title, reference) VALUES
      ('00000000-0000-0000-0000-000000000000', 'QUOTE', 'PENDING', 'Cotización RC Auto — revisión comercial', 'COT-2026-001'),
      ('00000000-0000-0000-0000-000000000000', 'ENDORSEMENT', 'PENDING', 'Endoso cobertura — aprobación técnica', 'END-2026-014');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
      AND title = 'SLA demo: seguimiento vencido (VIP)'
  ) THEN
    INSERT INTO tasks (tenant_id, type, status, title, due_at) VALUES
      ('00000000-0000-0000-0000-000000000000', 'SLA_FOLLOWUP', 'OPEN', 'SLA demo: seguimiento vencido (VIP)', now() - interval '1 day'),
      ('00000000-0000-0000-0000-000000000000', 'CLAIM_REVIEW', 'OPEN', 'Revisión estándar — vence en 48h', now() + interval '2 day');
  END IF;
END $$;
