-- Inicialización automática para Docker (solo en primera creación del volumen)
-- Crea el esquema + seed mínimo para poder probar APIs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Esquema (copiado de backend/db-schema.sql)

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('BROKER_ADMIN', 'PRODUCER')),
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS producers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT,
  phone_whatsapp TEXT,
  default_locale TEXT NOT NULL DEFAULT 'es-AR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  document_type TEXT,
  document_number TEXT,
  email TEXT,
  phone_whatsapp TEXT,
  date_of_birth DATE,
  tax_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  wa_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, wa_id)
);

CREATE TABLE IF NOT EXISTS insurers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  api_base_url TEXT,
  api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  insurer_id UUID REFERENCES insurers(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  insurer_id UUID REFERENCES insurers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  policy_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  premium NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_number)
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_claim_number TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED')),
  event_datetime TIMESTAMPTZ,
  event_location TEXT,
  narrative TEXT,
  requires_human_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuración de intake de siniestros por tenant (campos requeridos / labels)
CREATE TABLE IF NOT EXISTS claim_intake_configs (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  fields JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES producers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  wa_contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('CUSTOMER', 'PRODUCER', 'AI')),
  wa_message_id TEXT,
  text TEXT,
  media_type TEXT,
  media_storage_key TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Borradores de siniestro (después de conversations + claims: FK a ambas)
CREATE TABLE IF NOT EXISTS claim_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  type TEXT,
  event_datetime TIMESTAMPTZ,
  event_location TEXT,
  narrative TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'CONVERTED', 'CANCELLED')) DEFAULT 'DRAFT',
  extracted_payload JSONB,
  missing_fields JSONB,
  converted_claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  related_entity_type TEXT,
  related_entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS faq_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed mínimo: tenant fijo para que el backend pueda crear customers sin auth todavía.
INSERT INTO tenants (id, name, slug, timezone)
VALUES ('00000000-0000-0000-0000-000000000000', 'Tenant Demo', 'demo', 'America/Argentina/Buenos_Aires')
ON CONFLICT (slug) DO NOTHING;

-- Default intake config para el tenant demo (se puede ajustar por tenant)
INSERT INTO claim_intake_configs (tenant_id, fields)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '[
    {"key":"customerId","label":"Cliente","placeholder":"UUID del cliente","required":true},
    {"key":"policyId","label":"Póliza","placeholder":"UUID de la póliza","required":true},
    {"key":"type","label":"Tipo","placeholder":"AUTO / HOGAR / VIDA / OTRO","required":true},
    {"key":"eventDatetime","label":"Fecha y hora","placeholder":"2026-04-29T10:30:00-03:00","required":true},
    {"key":"eventLocation","label":"Lugar","placeholder":"Ciudad / barrio / dirección aproximada","required":true},
    {"key":"narrative","label":"Relato","placeholder":"Contá en pocas líneas el hecho","required":true}
  ]'::jsonb
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Dataset demo mínimo para probar "Inbox -> Crear siniestro -> Borrador -> Aprobar"
-- IDs fijos para facilitar demos
INSERT INTO insurers (id, tenant_id, name, code)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Aseguradora Demo',
  'DEMO'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, tenant_id, full_name, email, phone_whatsapp)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'Juan Pérez',
  'juan.perez@example.com',
  '+5491100000000'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'POL-DEMO-0001',
  'ACTIVE',
  '2026-01-01',
  '2026-12-31',
  'ARS',
  125000.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'POL-DEMO-0002',
  'ACTIVE',
  '2026-01-01',
  '2026-12-31',
  'ARS',
  89000.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

INSERT INTO conversations (id, tenant_id, customer_id, channel, topic, status)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'whatsapp',
  'Siniestro demo',
  'OPEN'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, direction, sender_type, text)
VALUES
  (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    'INBOUND',
    'CUSTOMER',
    'Hola, tuve un choque recién. Fue en Palermo a las 10:30. ¿Cómo sigo?'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    'OUTBOUND',
    'PRODUCER',
    'Hola Juan, gracias por avisar. Ya te guío para registrar el siniestro. ¿Hay terceros involucrados y hay heridos?'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '44444444-4444-4444-4444-444444444444',
    'INBOUND',
    'CUSTOMER',
    'No hay heridos. El otro auto se fue. Tengo fotos.'
  )
ON CONFLICT (id) DO NOTHING;

