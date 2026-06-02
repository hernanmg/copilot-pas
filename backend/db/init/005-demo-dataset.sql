-- Dataset rico para demo completa (Escenarios A-F)
-- Idempotente: ON CONFLICT DO NOTHING en todos los inserts con UUID fijo.
--
-- UUIDs ya sembrados en 001-schema-and-seed.sql:
--   Tenant demo:          00000000-0000-0000-0000-000000000000
--   Aseguradora Demo:     11111111-1111-1111-1111-111111111111
--   Cliente Juan Pérez:   22222222-2222-2222-2222-222222222222
--   Póliza POL-DEMO-0001: 33333333-3333-3333-3333-333333333333
--   Póliza POL-DEMO-0002: 88888888-8888-8888-8888-888888888888
--   Conversación choque:  44444444-4444-4444-4444-444444444444

-- ============================================================
-- 1. Aseguradoras reales
-- ============================================================
INSERT INTO insurers (id, tenant_id, name, code)
VALUES
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Sancor Seguros',   'SANCOR'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'Zurich Argentina', 'ZURICH')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Clientes adicionales
-- ============================================================
INSERT INTO customers (id, tenant_id, full_name, document_type, document_number, email, phone_whatsapp)
VALUES
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'María González', 'DNI', '27845632', 'maria.gonzalez@example.com', '+5491155550001'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'Carlos Méndez',  'DNI', '30124587', 'carlos.mendez@example.com',  '+5491155550002'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'Laura Sosa',     'DNI', '33901234', 'laura.sosa@example.com',     '+5491155550003')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Pólizas
-- ============================================================

-- Por vencer en 15 días → activa alerta de renovación en Escenario D
INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '30000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000002',   -- María González
  '10000000-0000-0000-0000-000000000002',   -- Sancor
  'SAN-2026-1001', 'ACTIVE',
  CURRENT_DATE - interval '350 days',
  CURRENT_DATE + interval '15 days',
  'ARS', 148000.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

-- Vencida — aparece con badge EXPIRED en la cartera
INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000003',   -- Carlos Méndez
  '10000000-0000-0000-0000-000000000003',   -- Zurich
  'ZUR-2025-2214', 'EXPIRED',
  '2025-01-01', '2025-12-31',
  'ARS', 210000.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

-- Activa (Carlos — Sancor Auto)
INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '30000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000003',   -- Carlos Méndez
  '10000000-0000-0000-0000-000000000002',   -- Sancor
  'SAN-2026-2001', 'ACTIVE',
  '2026-01-01', '2026-12-31',
  'ARS', 195000.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

-- Activa (Laura — Zurich Hogar)
INSERT INTO policies (id, tenant_id, customer_id, insurer_id, policy_number, status, start_date, end_date, currency, premium)
VALUES (
  '30000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000004',   -- Laura Sosa
  '10000000-0000-0000-0000-000000000003',   -- Zurich
  'ZUR-2026-4403', 'ACTIVE',
  '2026-01-01', '2026-12-31',
  'ARS', 87500.00
)
ON CONFLICT (tenant_id, policy_number) DO NOTHING;

-- ============================================================
-- 4. Siniestros con historial de eventos
-- ============================================================

-- Escenario C: siniestro auto en revisión — requiere intervención humana
INSERT INTO claims (id, tenant_id, policy_id, customer_id, type, status, event_datetime, event_location, narrative, requires_human_review)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',   -- POL-DEMO-0001 (Juan Pérez)
  '22222222-2222-2222-2222-222222222222',   -- Juan Pérez
  'AUTO', 'IN_REVIEW',
  now() - interval '3 days',
  'Av. Santa Fe 3400, CABA',
  'Colisión entre dos vehículos en intersección semafórica. El cliente indica luz verde a su favor. Tercero dado a la fuga. Daños en paragolpes delantero y capó. Sin heridos.',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO claim_events (id, claim_id, type, payload)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'SUBMITTED',
    '{"source":"whatsapp","intake_session":"sess-demo-001","operator":"productor@demo.local"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    'STATUS_CHANGED',
    '{"from":"SUBMITTED","to":"IN_REVIEW","reason":"Daños estimados superiores al umbral de revisión automática (ARS 500.000)","flagged_by":"system"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Siniestro hogar cerrado — histórico para mostrar en listado
INSERT INTO claims (id, tenant_id, policy_id, customer_id, type, status, event_datetime, event_location, narrative, requires_human_review)
VALUES (
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000002',   -- SAN-2026-1001 (María González)
  '20000000-0000-0000-0000-000000000002',   -- María González
  'HOGAR', 'CLOSED',
  now() - interval '45 days',
  'Belgrano, CABA',
  'Daño por agua en cañería de cocina. Afectó piso de madera y placard. Perito de Sancor tasó ARS 320.000.',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO claim_events (id, claim_id, type, payload)
VALUES
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    'SUBMITTED',
    '{"source":"web","operator":"productor@demo.local"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000002',
    'STATUS_CHANGED',
    '{"from":"SUBMITTED","to":"IN_REVIEW","reason":"En revisión pericial","flagged_by":"system"}'::jsonb
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000002',
    'STATUS_CHANGED',
    '{"from":"IN_REVIEW","to":"CLOSED","reason":"Indemnización pagada. Expediente cerrado.","closed_by":"productor@demo.local"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Conversaciones adicionales con mensajes
-- ============================================================

-- Escenario B: consulta de cobertura (María González) → RAG dispatch
INSERT INTO conversations (id, tenant_id, customer_id, channel, topic, status)
VALUES (
  '60000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000002',
  'whatsapp', 'Consulta cobertura hogar', 'OPEN'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, direction, sender_type, text)
VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    'INBOUND', 'CUSTOMER',
    'Hola, quería saber si mi seguro de hogar cubre daño por granizo en el techo. Acá en Palermo cayó granizo fuerte la semana pasada.'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000002',
    'OUTBOUND', 'AI',
    'Hola María, tu póliza SAN-2026-1001 de Sancor incluye cobertura por fenómenos meteorológicos, incluido granizo, sobre estructuras. Te preparé un borrador para compartirle.'
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '60000000-0000-0000-0000-000000000002',
    'OUTBOUND', 'PRODUCER',
    'María, revisamos tu cobertura y el granizo está incluido. ¿Podés mandarme fotos del daño para iniciar la denuncia?'
  ),
  (
    '70000000-0000-0000-0000-000000000004',
    '60000000-0000-0000-0000-000000000002',
    'INBOUND', 'CUSTOMER',
    'Sí, te las mando ahora. ¿Necesito llamar a Sancor también?'
  )
ON CONFLICT (id) DO NOTHING;

-- Escenario A: cotización auto (Carlos Méndez) → agente COMMERCIAL
INSERT INTO conversations (id, tenant_id, customer_id, channel, topic, status)
VALUES (
  '60000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000003',
  'whatsapp', 'Cotización auto — VW Vento 2023', 'OPEN'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, direction, sender_type, text)
VALUES
  (
    '70000000-0000-0000-0000-000000000005',
    '60000000-0000-0000-0000-000000000003',
    'INBOUND', 'CUSTOMER',
    'Buen día, quiero cotizar un seguro para mi auto nuevo. Es un VW Vento 2023, uso particular, lo guardo en cochera en Caballito.'
  ),
  (
    '70000000-0000-0000-0000-000000000006',
    '60000000-0000-0000-0000-000000000003',
    'OUTBOUND', 'AI',
    'Para cotizar necesito: DNI del titular, año/modelo/patente y si tiene alarma o rastreo. ¿Preferís contra todo riesgo o terceros completos?'
  ),
  (
    '70000000-0000-0000-0000-000000000007',
    '60000000-0000-0000-0000-000000000003',
    'OUTBOUND', 'PRODUCER',
    'Hola Carlos, dale. ¿Tenés la patente a mano? Te mando opciones de todo riesgo vs. terceros para que compares.'
  ),
  (
    '70000000-0000-0000-0000-000000000008',
    '60000000-0000-0000-0000-000000000003',
    'INBOUND', 'CUSTOMER',
    'La patente es AB 456 CD. Quiero contra todo riesgo. Tengo alarma de fábrica y rastreo Skylock.'
  )
ON CONFLICT (id) DO NOTHING;

-- Escenario C: intake en curso (Laura Sosa — rotura cañería) → borrador en mid-flow
INSERT INTO conversations (id, tenant_id, customer_id, channel, topic, status)
VALUES (
  '60000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000004',
  'whatsapp', 'Siniestro hogar — pérdida de agua', 'OPEN'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, direction, sender_type, text)
VALUES
  (
    '70000000-0000-0000-0000-000000000009',
    '60000000-0000-0000-0000-000000000004',
    'INBOUND', 'CUSTOMER',
    'Hola, se me rompió un caño en el baño y hay agua por todos lados. ¿Cómo hago para hacer el seguro?'
  ),
  (
    '70000000-0000-0000-0000-000000000010',
    '60000000-0000-0000-0000-000000000004',
    'OUTBOUND', 'PRODUCER',
    'Laura, qué mal! Primero cerrá la llave general del agua. Para el siniestro necesito que me pases: ¿cuándo fue exactamente y en qué habitación?'
  ),
  (
    '70000000-0000-0000-0000-000000000011',
    '60000000-0000-0000-0000-000000000004',
    'INBOUND', 'CUSTOMER',
    'Fue hoy a las 8 de la mañana, en el baño principal del segundo piso. El piso de madera está todo encharcado.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. Borrador de siniestro en curso (mid-flow del intake wizard)
-- ============================================================
INSERT INTO claim_drafts (
  id, tenant_id, source_conversation_id, customer_id, policy_id,
  type, event_datetime, event_location, narrative,
  status, extracted_payload, missing_fields
)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  '60000000-0000-0000-0000-000000000004',   -- conv Laura
  '20000000-0000-0000-0000-000000000004',   -- Laura Sosa
  '30000000-0000-0000-0000-000000000005',   -- ZUR-2026-4403
  'HOGAR',
  now() - interval '6 hours',
  NULL,   -- falta: aún no capturado
  'Rotura de cañería en baño principal, piso de madera encharcado.',
  'DRAFT',
  '{"type":"HOGAR","eventDatetime":"2026-05-22T08:00:00-03:00","narrative":"Rotura de cañería en baño principal, piso de madera encharcado."}'::jsonb,
  '["eventLocation"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Tareas adicionales de seguimiento
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
      AND title = 'Llamar a María González — renovación en 15 días'
  ) THEN
    INSERT INTO tasks (tenant_id, type, status, title, related_entity_type, related_entity_id, due_at)
    VALUES
      (
        '00000000-0000-0000-0000-000000000000',
        'RENEWAL_FOLLOWUP', 'OPEN',
        'Llamar a María González — renovación en 15 días',
        'POLICY', '30000000-0000-0000-0000-000000000002',
        CURRENT_DATE + interval '7 days'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'CLAIM_REVIEW', 'IN_PROGRESS',
        'Revisar documentación siniestro auto — Juan Pérez (IN_REVIEW)',
        'CLAIM', '40000000-0000-0000-0000-000000000001',
        CURRENT_DATE + interval '1 day'
      );
  END IF;
END $$;

-- ============================================================
-- 8. Solicitud de aprobación adicional
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM approval_requests
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
      AND reference = 'SIN-2026-0042'
  ) THEN
    INSERT INTO approval_requests (tenant_id, kind, status, title, reference, metadata)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'CLAIM_APPROVAL', 'PENDING',
      'Siniestro auto Juan Pérez — aprobación indemnización estimada ARS 520.000',
      'SIN-2026-0042',
      '{"claim_id":"40000000-0000-0000-0000-000000000001","estimated_amount":520000,"currency":"ARS"}'::jsonb
    );
  END IF;
END $$;
