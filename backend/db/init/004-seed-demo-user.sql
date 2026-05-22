-- Usuario demo para login en entornos nuevos (volumen DB recién creado).
-- Email: productor@demo.local  |  Contraseña: demo1234
-- Tenant: mismo UUID demo que usa el seed de tenants.

INSERT INTO users (tenant_id, email, password_hash, role, display_name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'productor@demo.local',
  '$2a$10$jikbs3IgjdKbUtF12ViDdunF7bSi5cIP4joBygBB3tRsHUaKhmkBO',
  'PRODUCER',
  'Productor demo',
  true
)
ON CONFLICT (tenant_id, email) DO NOTHING;
