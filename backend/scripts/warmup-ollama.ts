/**
 * Warmup de modelos Ollama antes de la demo.
 * Envía 1 request a /orchestrator/chat (carga llama3.2 en RAM)
 * y 1 request a /rag/index con texto corto (carga mxbai-embed-large en RAM).
 *
 * Uso:
 *   cd backend
 *   npm run warmup
 *
 * Variables de entorno (leídas de .env.local o .env si existen):
 *   BASE_URL        URL base de la API    (default: http://localhost:4000)
 *   DEMO_EMAIL      Email demo            (default: productor@demo.local)
 *   DEMO_PASSWORD   Contraseña demo       (default: demo1234)
 *   OLLAMA_EMBED_MODEL  Modelo embeddings (default: mxbai-embed-large)
 *
 * Nota: el primer request puede tardar 30–90 segundos si el modelo no está en RAM.
 * Corré este script 2–3 minutos antes de arrancar la demo.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ── Carga .env.local y .env (el primero gana) ─────────────────────────────

function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(__dirname, '..', file), 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
        }
      }
    } catch {
      /* archivo ausente — ignorar */
    }
  }
}

loadEnv();

// ── Configuración ─────────────────────────────────────────────────────────

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'productor@demo.local';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'mxbai-embed-large';
const TENANT_ID = '00000000-0000-0000-0000-000000000000';

// ── Helpers HTTP ──────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login fallido (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { accessToken: string };
  if (!data.accessToken) throw new Error('Login OK pero no devolvió accessToken');
  return data.accessToken;
}

async function warmupOrchestrator(token: string): Promise<void> {
  // Usamos un mensaje de consulta de póliza para que el orquestador dispare
  // RAG retrieval, cargando tanto el modelo LLM como el de embeddings.
  const res = await fetch(`${BASE_URL}/orchestrator/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({
      message: '¿Qué cubre el granizo en la póliza de hogar?',
      channel: 'WEB',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`orchestrator/chat (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { intent: string; agent: string };
  console.log(`    intent=${data.intent} · agent=${data.agent}`);
}

async function warmupEmbeddings(token: string): Promise<void> {
  // Indexa un fragmento de texto corto para forzar la carga del modelo de embeddings.
  const res = await fetch(`${BASE_URL}/rag/index`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({
      scope: 'GENERIC_KB',
      sourceType: 'MANUAL_NOTE',
      sourceRef: 'warmup-doc',
      title: 'Sistema listo para demo',
      locale: 'es-AR',
      embeddingModel: EMBED_MODEL,
      fullText:
        'Copilot Seguros está listo para la demo. Este documento verifica que el modelo de embeddings está cargado y operativo.',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`rag/index (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { chunkCount: number };
  console.log(`    ${data.chunkCount} chunk(s) indexados`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔐  Login → ' + BASE_URL);
  const token = await login();
  console.log('    OK\n');

  {
    process.stdout.write('🤖  Orquestador (llama3.2)… ');
    const t0 = Date.now();
    await warmupOrchestrator(token);
    console.log(`    ✓  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  console.log('');

  {
    process.stdout.write('🔢  Embeddings (' + EMBED_MODEL + ')… ');
    const t0 = Date.now();
    await warmupEmbeddings(token);
    console.log(`    ✓  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  console.log('\n✅  Warmup completo. Los modelos están en RAM, la demo puede arrancar.\n');
}

main().catch((err) => {
  console.error('\n❌  Error:', (err as Error).message);
  process.exit(1);
});
