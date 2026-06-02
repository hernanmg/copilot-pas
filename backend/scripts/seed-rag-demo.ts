/**
 * Seed de documentos demo para RAG (pgvector).
 * Indexa 3 documentos con texto hardcodeado vía POST /rag/index.
 *
 * Uso:
 *   cd backend
 *   npm run seed:rag
 *
 * Variables de entorno (leídas de .env.local o .env si existen):
 *   BASE_URL        URL base de la API    (default: http://localhost:4000)
 *   DEMO_EMAIL      Email demo            (default: productor@demo.local)
 *   DEMO_PASSWORD   Contraseña demo       (default: demo1234)
 *   OLLAMA_EMBED_MODEL  Modelo embeddings (default: mxbai-embed-large)
 *
 * Requiere Node ≥ 18 (fetch nativo) y Ollama corriendo con el modelo de embeddings cargado.
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

// ── Documentos demo ───────────────────────────────────────────────────────

const DOCUMENTS = [
  {
    scope: 'FAQ',
    sourceType: 'FAQ_SYNC',
    sourceRef: 'faq-granizo-hogar-v1',
    title: 'FAQ — Cobertura de granizo en seguro de hogar',
    fullText: `Preguntas frecuentes: Cobertura de granizo en seguro de hogar

¿Está cubierto el granizo en mi seguro de hogar?
Sí. Las pólizas de hogar de Sancor incluyen cobertura por fenómenos meteorológicos, incluido granizo, sobre la estructura de la vivienda: techo, canaletas, aberturas y muros exteriores. La cobertura no incluye daños a bienes muebles por granizo directo salvo que la póliza tenga cláusula de contenido.

¿Cómo denuncio un daño por granizo?
1. Tomá fotos y/o video del daño antes de hacer cualquier reparación provisoria.
2. Avisá a tu productor dentro de las 72 horas del evento.
3. El productor inicia el trámite y coordina la visita del perito con la aseguradora.
4. El perito inspecciona el inmueble y emite el informe de tasación.
5. Sancor resuelve la indemnización o coordina la reparación según condiciones de póliza.

¿Necesito denuncia policial por granizo?
No. El granizo es un fenómeno meteorológico natural; no se requiere denuncia policial. Sí conviene adjuntar documentación fotográfica y, cuando sea posible, un informe meteorológico de la fecha del hecho.

¿Cuánto tarda la indemnización por granizo?
El plazo promedio de resolución es de 15 a 30 días hábiles desde que el perito emite el informe. Pólizas con deducible o con cobertura de reparación coordinada pueden tener plazos diferentes. El productor informa el estado del trámite cada 5 días hábiles.

¿Qué pasa si el daño ocurrió antes de que contratar el seguro?
Los daños preexistentes al inicio de vigencia de la póliza no están cubiertos. La aseguradora puede solicitar un informe fotográfico previo del inmueble si existe sospecha de daño anterior. En casos dudosos el perito evalúa la antigüedad del daño.

¿El granizo cubre también el auto que estaba en cochera?
Si el vehículo está dentro de la vivienda asegurada (cochera propia) y la póliza incluye cobertura de cochera, sí puede estar cubierto el daño al auto por granizo. Consultar las cláusulas particulares de la póliza de hogar. El seguro de auto en sí cubre granizo solo si tiene cobertura todo riesgo o endoso específico.`,
  },
  {
    scope: 'INSURER_CONDITIONS',
    sourceType: 'INSURER_API',
    sourceRef: 'sancor-auto-cond-gral-v2026',
    title: 'Condiciones Generales — Seguro de Automotor · Sancor Seguros',
    fullText: `Condiciones Generales — Seguro de Automotor
Aseguradora: Sancor Seguros (documento ficticio con fines de demo)
Vigencia: Pólizas emitidas desde enero 2026

Art. 1 — Objeto del seguro
La aseguradora cubre los daños materiales causados al vehículo asegurado y la responsabilidad civil del asegurado frente a terceros, según la modalidad contratada: todo riesgo, terceros completos o terceros básico.

Art. 2 — Cobertura de colisión y vuelco
En pólizas con cobertura todo riesgo, se cubren los daños al vehículo propios causados por colisión con otro vehículo, objeto fijo o vuelco, sin importar la responsabilidad del asegurado. La suma asegurada máxima por colisión es la indicada en el certificado de póliza, actualizable por endoso.

Art. 3 — Exclusiones
Quedan excluidos: daños por desgaste normal y uso, daños intencionales causados por el asegurado o conductor autorizado, circulación sin licencia habilitante vigente, participación en competencias deportivas no autorizadas, y daños producidos bajo el efecto de alcohol o sustancias psicoactivas prohibidas.

Art. 4 — Responsabilidad civil obligatoria
La cobertura de RC obligatoria comprende daños a terceros por lesiones corporales o fallecimiento hasta la suma asegurada establecida en el certificado de póliza. El endoso de RC voluntaria amplía dicho límite hasta el monto contratado. No cubre daños a bienes propios del asegurado.

Art. 5 — Robo y hurto
La cobertura de robo total e incendio cubre la pérdida del vehículo por robo total, previa denuncia policial dentro de las 24 horas del hecho. El robo parcial de accesorios no de fábrica no está cubierto salvo endoso expreso. La indemnización se calcula sobre el valor de mercado del vehículo al momento del siniestro, menos deducible contractual.

Art. 6 — Suma asegurada y actualización
La suma asegurada se establece en base al valor de mercado del vehículo a la fecha de renovación anual. El asegurado puede solicitar actualización por endoso en cualquier momento. La cláusula de valor de reposición sin descuento por depreciación requiere contratación expresa.

Art. 7 — Denuncia del siniestro
El asegurado debe denunciar el siniestro dentro de las 72 horas de producido. En caso de robo, la denuncia policial es condición previa a la apertura del expediente. La demora injustificada en la denuncia puede dar lugar a reducción proporcional de la indemnización según el perjuicio causado.

Art. 8 — Valuación del daño y peritos
Los daños materiales son valuados por perito designado por la aseguradora. El asegurado tiene derecho a designar un perito propio a su cargo. En caso de desacuerdo entre peritos, se designa un perito dirimente cuyo honorario es dividido entre ambas partes. La reparación puede ser coordinada por la aseguradora o indemnizada en dinero a opción del asegurado.

Art. 9 — Franquicia y deducible
Las pólizas de todo riesgo con deducible requieren que el asegurado absorba el porcentaje indicado en condiciones particulares. Las coberturas de RC obligatoria no tienen deducible.

Art. 10 — Vigencia y renovación
La póliza se renueva automáticamente al vencimiento salvo aviso de cancelación con 30 días de anticipación por cualquiera de las partes. El productor es responsable de notificar al asegurado la proximidad del vencimiento con al menos 30 días de antelación.`,
  },
  {
    scope: 'PLAYBOOK',
    sourceType: 'MANUAL_NOTE',
    sourceRef: 'playbook-siniestro-granizo-v1',
    title: 'Playbook del productor — Siniestros por granizo (hogar)',
    fullText: `Playbook interno del productor — Manejo de siniestros por granizo en póliza de hogar
Versión: 1.0 · Copilot Seguros

Propósito
Este playbook guía al PAS en la gestión eficiente de un siniestro de granizo desde el primer contacto hasta el cierre del expediente, con énfasis en comunicación empática, recopilación rápida de datos y coordinación con la aseguradora.

Paso 1 — Primera respuesta al asegurado (0–2 horas del hecho)
Cuando el asegurado reporta un siniestro de granizo, respondé en el mismo canal con un mensaje de contención dentro de las 2 horas. Ejemplo de borrador:
"Lamentamos los daños. Lo primero es tu seguridad: asegurate de que el techo no tenga riesgo de derrumbe. No hagas reparaciones definitivas todavía; solo provisorias si hay filtración urgente. Sacá fotos y video de todo el daño antes de tocar nada. Te guío para iniciar el trámite hoy mismo."
No prometer plazos de indemnización en este primer mensaje. Proyectar calma y profesionalismo.

Paso 2 — Relevamiento de datos (2–24 horas)
Capturá los siguientes datos antes de abrir el expediente:
- Nombre completo, DNI y teléfono del asegurado
- Número de póliza y nombre de la compañía aseguradora
- Fecha y hora aproximada del granizo (o evento meteorológico)
- Dirección exacta del inmueble afectado
- Descripción del daño: techo (tipo de cubierta), canaletas, aberturas (vidrios, marcos), muros, bienes en interior
- Fotos o video del daño (solicitar antes de cualquier reparación)
- Presupuesto de reparación si el asegurado ya lo tiene; si no, orientarlo a pedirlo
- Si hay servicio de emergencia contratado, activarlo de inmediato para protección provisoria

Paso 3 — Apertura del expediente en el sistema
Entrá a Copilot Seguros → Inbox → conversación del asegurado → botón "Iniciar siniestro".
El sistema extrae los datos cargados en el chat y genera un borrador. Revisá y completá los campos faltantes, particularmente:
- Póliza vinculada (verificar que esté ACTIVE)
- Tipo: HOGAR
- Fecha y lugar del hecho
- Relato descriptivo del daño
Aprobá el borrador para crear el expediente formal. El sistema registra los eventos de apertura.

Paso 4 — Notificación a la aseguradora
Tras la apertura, notificá a Sancor por el canal acordado (portal web, email o sistema de siniestros). Adjuntá:
- Número de póliza y datos del asegurado
- Descripción del daño
- Fotos del daño
La aseguradora confirma recepción y designa perito dentro de los 3 días hábiles.

Paso 5 — Coordinación con el perito
Una vez designado el perito, coordinar fecha y hora de visita con el asegurado. Informar al asegurado:
- Que el perito es designado por la aseguradora para tasar el daño
- Que tenga disponible toda la documentación del inmueble y de la póliza
- Que no realice reparaciones definitivas antes de la visita del perito (puede invalidar la tasación)
Acompañar la visita cuando sea posible. Si el asegurado quiere designar perito propio, informar el procedimiento (ver Art. 8 Condiciones Generales).

Paso 6 — Seguimiento post-peritaje
Hacer seguimiento del expediente cada 5 días hábiles hasta resolución. Contactar a la aseguradora si hay demoras. Informar al asegurado el estado del trámite. Si la aseguradora demora más de 20 días hábiles sin emitir resolución, escalar a la gerencia de siniestros con copia al asegurado.

Paso 7 — Cierre del siniestro
Verificar que la indemnización se acredite correctamente o que la reparación coordinada se complete de forma satisfactoria. Pedir conformidad del asegurado. Actualizar el estado del siniestro a CLOSED en el sistema. Archivar el expediente con toda la documentación.

Indicadores de calidad para este tipo de siniestro
- Tiempo de primera respuesta al asegurado: < 2 horas
- Apertura de expediente: < 24 horas del hecho
- Resolución promedio esperada: 15–30 días hábiles
- Satisfacción post-cierre: consultar al asegurado si el proceso fue claro y ágil`,
  },
] as const;

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

async function indexDocument(
  token: string,
  doc: (typeof DOCUMENTS)[number],
): Promise<{ documentId: string; chunkCount: number }> {
  const res = await fetch(`${BASE_URL}/rag/index`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({
      scope: doc.scope,
      sourceType: doc.sourceType,
      sourceRef: doc.sourceRef,
      title: doc.title,
      locale: 'es-AR',
      embeddingModel: EMBED_MODEL,
      fullText: doc.fullText,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error indexando "${doc.title}" (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ documentId: string; chunkCount: number }>;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🔐  Login → ${BASE_URL}`);
  const token = await login();
  console.log('    OK — token obtenido\n');

  for (const doc of DOCUMENTS) {
    const label = `[${doc.scope}] ${doc.title}`;
    process.stdout.write(`⏳  Indexando ${label}… `);
    const t0 = Date.now();
    try {
      const result = await indexDocument(token, doc);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✓  ${result.chunkCount} chunks · ${elapsed}s`);
    } catch (err) {
      console.log(`✗  ${(err as Error).message}`);
    }
  }

  console.log('\n✅  Seed RAG completo.\n');
}

main().catch((err) => {
  console.error('\n❌  Error:', (err as Error).message);
  process.exit(1);
});
