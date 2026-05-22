# IA copilot for insurance producers system design
_Exported on 4/16/2026 at 10:34:15 GMT-3 from Cursor (3.0.12)_

---

**User**

Actúa como un arquitecto senior de sistemas de inteligencia artificial, experto en LLMs, sistemas multi-agente, SaaS B2B y automatización en la industria de seguros.

Tu tarea es diseñar un sistema completo, realista y deployable de:

# 🚀 “Copilot de IA para Productores de Seguros (PAS)”

---

## 🎯 OBJETIVO DEL SISTEMA

Construir una plataforma SaaS multi-tenant utilizada por brokers de seguros para:

- Atraer y retener productores (PAS)
- Mejorar su capacidad de venta
- Automatizar operaciones
- Profesionalizar su servicio al cliente

El sistema debe permitir que un productor pequeño/mediano opere con capacidades similares a un broker grande.

---

## 🧭 CONTEXTO DE NEGOCIO (CRÍTICO)

- El usuario principal es el PRODUCTOR DE SEGUROS (no el cliente final)
- El sistema también es una herramienta de captación de productores para brokers
- El valor NO es solo automatización, sino:
  - vender más
  - responder más rápido
  - mejorar imagen profesional

Existen competidores como Polko y Visred que ofrecen sistemas de gestión.

Tu solución debe diferenciarse mediante:

- IA aplicada de forma práctica
- Automatización end-to-end
- Experiencia tipo “copiloto inteligente”

---

## 🧩 ARQUITECTURA GENERAL

Diseña una arquitectura basada en:

- Sistema multi-agente
- Orquestador central
- Memoria persistente por cliente
- Integración con sistemas externos (compañías de seguros via APIs/web services)
- WhatsApp como canal principal

Describe:

- Diagrama de arquitectura (en texto)
- Flujo de comunicación entre agentes
- Manejo de contexto y memoria

---

## 🤖 AGENTES DEL SISTEMA

### 1. Agente Comercial
- Genera propuestas personalizadas
- Sugiere productos
- Detecta oportunidades de upselling/cross-selling
- Automatiza follow-ups

Inputs:
- CRM
- Historial del cliente
- Datos personales (edad, bienes, etc.)

Outputs:
- Mensajes listos para WhatsApp
- Recomendaciones accionables para el productor

---

### 2. Agente Analista de Pólizas
- Lee PDFs (con OCR si aplica)
- Extrae coberturas, exclusiones y límites
- Compara pólizas
- Genera resúmenes claros

---

### 3. Agente de Atención (Chatbot)
- Responde consultas en tiempo real vía WhatsApp
- Consulta estado de pólizas
- Maneja FAQs

Debe:
- Tener tono humano
- Escalar a humano cuando sea necesario

---

### 4. Agente de Siniestros (CRÍTICO)
Debe ser el más avanzado.

Flujo:
- ¿Qué pasó?
- ¿Cuándo?
- ¿Dónde?
- Solicitud de fotos/documentación

Capacidades:
- Procesamiento de imágenes
- Geolocalización
- Validación contra póliza
- Generación automática de reporte estructurado

---

### 5. Orquestador (Cerebro)
- Decide qué agente usar
- Mantiene contexto del cliente
- Coordina workflows multi-step
- Evita inconsistencias

Debe incluir:
- Routing inteligente
- Memoria corto y largo plazo
- Manejo de sesiones

---

## ⚙️ REQUISITOS TÉCNICOS

Define en detalle:

### Stack sugerido
- Backend NestJs
- FrontEnd  Next.js(React)
- Base de datos ( postgres o la que sugieras)
- Vector DB (embeddings)
- Infraestructura (cloud)
- Integración con WhatsApp API

### Memoria
- Memoria por cliente
- Memoria por productor
- Uso de embeddings + retrieval

### Tools por agente
Ejemplos:
- Lector de PDFs
- OCR
- CRM connector
- APIs de aseguradoras
- Motor de cotización

---

## 🔄 FLUJOS CLAVE (PASO A PASO)

Describe end-to-end:

1. Venta de póliza
2. Consulta de cliente vía WhatsApp
3. Denuncia de siniestro completa

Incluye decisiones del orquestador en cada paso.

---

## 🧠 INTELIGENCIA DEL SISTEMA

Define:

- Qué decisiones toma el LLM vs lógica determinística
- Manejo de ambigüedad del usuario
- Manejo de errores
- Validaciones críticas (ej: siniestros)

---

## 📊 ESCALABILIDAD Y NEGOCIO

- Multi-tenant (broker → productores → clientes)
- Seguridad (datos sensibles / PII)
- Logs y auditoría
- Escalabilidad horizontal

---

## 💰 PROPUESTA DE VALOR

Explica claramente cómo el sistema:

- Aumenta ventas del productor
- Reduce carga operativa
- Mejora la experiencia del cliente final

---

## 📈 KPIs

Define métricas como:

- Tiempo de respuesta
- Tasa de conversión
- % de automatización de siniestros
- Retención de productores

---

## 📦 OUTPUT ESPERADO

Responde con:

1. Arquitectura completa (explicada en texto)
2. Diseño detallado de cada agente
3. Flujos end-to-end
4. Stack tecnológico recomendado
5. Ejemplo real de conversación por WhatsApp
6. Contratos JSON de entrada/salida entre agentes
7. Riesgos + mitigaciones
8. Roadmap MVP (30-60 días)

---

## 🚨 IMPORTANTE

- Evita generalidades
- Sé técnico y específico
- Propón decisiones concretas (no opciones abiertas)
- Prioriza soluciones simples pero escalables
- Piensa como si esto se fuera a construir en producción

---

**Cursor**

### 1) Arquitectura completa (deployable) — multi-tenant, multi-agente, WhatsApp-first

#### Principios de diseño (decisiones concretas)
- **WhatsApp como “sistema operativo”** del productor: toda interacción entra/sale por WA; el productor solo “aprueba” o “corrige” cuando hace falta.
- **Orquestación central + agentes especializados**: un único “cerebro” controla estado, políticas, ruteo y consistencia; los agentes no hablan directo con WhatsApp ni con DB sin pasar por tools gobernadas.
- **Memoria por tenant/productor/cliente** con separación dura: Postgres (fuente de verdad) + vector store (RAG) + cache (sesión).
- **LLM decide “qué hacer” y “cómo decirlo”**; la plataforma decide “qué está permitido”, “qué datos usar”, “qué validar” y “qué se audita”.
- **Event-driven + workflow engine** para pasos largos (venta, siniestro) con reintentos y trazabilidad.

---

#### Diagrama de arquitectura (texto)

```
[WhatsApp Cloud API]
        |
   (webhook)
        v
[API Gateway / BFF NestJS]
- Auth (producer/broker)
- Tenant resolver (broker_id)
- Rate limit / WAF
- Idempotency keys
        |
        v
[Conversation Service]
- Normaliza mensajes (texto, audio, imagen, docs)
- Session state (Redis)
- Encola eventos
        |
        v
[Orchestrator Service "Cerebro"]
- Intent + routing
- Policy & safety (PII, actions)
- Context assembly (short/long memory)
- Workflow engine (Temporal o n8n self-hosted + DB)
        |
        +------------------------------+
        |                              |
        v                              v
[Agent Runtime]                   [Tool Services]
(Agentes LLM)                     (Determinístico)
- Comercial                        - CRM Connector
- Atención                         - Aseguradoras API Gateway
- Analista de Pólizas              - Cotizador/Rating Engine
- Siniestros                       - PDF/OCR Service
                                   - Vision/Image Service
                                   - Geo Service
                                   - Notification Scheduler
                                   - Audit/Logging
        |
        v
[Message Composer]
- Plantillas + tono por productor
- Controles de compliance
        |
        v
[WhatsApp Sender]
- Envío + tracking (status)
- Anti-dup + retries
```

---

#### Comunicación entre agentes (flujo interno)
- **Entrada** (WhatsApp) → `Conversation Service` crea `ConversationEvent`.
- `Orchestrator`:
  - clasifica intención (venta/consulta/siniestro/admin),
  - decide agente,
  - arma contexto (memoria + datos de sistemas),
  - ejecuta **plan** (multi-step) usando tools,
  - pide al agente **redacción** o **estructura**,
  - aplica validaciones/políticas,
  - entrega “borrador” al productor o responde al cliente (según nivel de riesgo).

---

#### Manejo de contexto y memoria (corto y largo plazo)
- **Memoria corta (sesión)**: Redis
  - `session:{tenant}:{wa_user}` con los últimos N turnos + “estado de workflow” (ej. siniestro paso 3/7).
  - TTL 24–72h (configurable).
- **Memoria larga (conocimiento recuperable)**: Vector DB
  - Embeddings de: pólizas PDF, condiciones generales, FAQ del broker, historial de conversaciones relevantes, notas del productor, siniestros previos.
  - Índices separados por: `tenant_id`, `producer_id`, `customer_id`, `policy_id` (filtros obligatorios).
- **Fuente de verdad (datos operativos)**: Postgres
  - Clientes, pólizas, endosos, siniestros, tareas, mensajes, consentimientos, auditoría, configuraciones de tono/brand.
- **RAG gobernado**:
  - Retrieval determinístico: topK + filtros + “document type allowlist”.
  - Respuestas con “citabilidad interna” (IDs de docs) para auditoría y QA.

---

### 2) Diseño detallado de cada agente (rol, tools, entradas/salidas, guardrails)

#### 2.1 Agente Comercial
**Objetivo**: aumentar ventas del productor (velocidad + personalización + follow-up).
- **Decisiones LLM**:
  - identificar oportunidad (upsell/cross-sell),
  - proponer argumentos y objeciones,
  - redactar mensajes y secuencias.
- **Decisiones determinísticas**:
  - elegibilidad de producto (reglas),
  - límites/coberturas “hard” desde tarifario/aseguradora,
  - agenda de follow-up y cadencias.

**Tools**
- `crm.searchLead`, `crm.getCustomerProfile`, `crm.listPolicies`
- `quoteEngine.simulate(product, risk_data)`
- `insurerApi.getProducts`, `insurerApi.getUnderwritingRules`
- `scheduler.createFollowup`, `whatsapp.sendTemplate` (si aplica)
- `vector.searchSalesPlaybook` (scripts del broker)

**Output típico**
- 1–3 mensajes listos para WhatsApp + checklist “pedir datos faltantes” + próxima acción.

**Guardrails**
- No prometer coberturas no confirmadas.
- Si falta dato crítico (dominio, suma asegurada, localidad), pedirlo antes de cotizar.

---

#### 2.2 Agente Analista de Pólizas
**Objetivo**: leer/extraer/comparar pólizas con lenguaje claro y accionable.
- **Pipeline determinístico**:
  1) `pdf.extractText` (y `ocr.run` si baja calidad)
  2) `policyParser.extract` → JSON normalizado (coberturas, límites, deducibles, exclusiones, vigencias)
  3) `policyComparator.diff` (dos o más pólizas)
- **LLM**:
  - resumir “en criollo”,
  - identificar riesgos de huecos de cobertura,
  - redactar explicación para cliente.

**Tools**
- `pdf.extractText`, `ocr.run`, `policyParser.extract`, `policyComparator.diff`
- `vector.indexDocument` (guardar póliza y embeddings)

**Guardrails**
- Marcar con nivel de confianza por campo (ej. `confidence: 0.62` si OCR dudoso).
- Si confianza baja en exclusiones/deducibles, pedir revisión humana.

---

#### 2.3 Agente de Atención (Chatbot WhatsApp)
**Objetivo**: responder rápido, humano, y escalar cuando corresponde.
- **LLM**:
  - tono humano + empatía,
  - preguntas aclaratorias mínimas,
  - resumen para el productor cuando escala.
- **Determinístico**:
  - autenticación ligera por WhatsApp (OTP opcional o “pregunta de validación” según sensibilidad),
  - lectura de estado de póliza/siniestro desde Postgres/aseguradora,
  - reglas de escalamiento.

**Tools**
- `policy.getStatus`, `claim.getStatus`, `faq.search`, `humanHandoff.createTicket`
- `whatsapp.send`, `whatsapp.sendInteractive` (botones/quick replies)

**Escalamiento (reglas)**
- Amenaza legal / queja grave / lesión / fallecimiento
- Solicitud de cancelación/reintegro complejo
- Inconsistencias de identidad o datos sensibles

---

#### 2.4 Agente de Siniestros (crítico y más avanzado)
**Objetivo**: llevar al cliente desde “tuve un siniestro” a un **reporte completo y válido**, reduciendo ida y vuelta.
- **Estrategia**: “entrevista guiada” + validación contra póliza + checklist documental por tipo de siniestro.

**Subcapacidades**
- **Comprensión multimodal**: fotos del daño, cédula, denuncia policial, presupuesto.
- **Geolocalización**: ubicación declarada vs GPS (si el cliente comparte ubicación).
- **Validación**:
  - vigencia activa,
  - cobertura aplicable,
  - deducible,
  - exclusiones relevantes,
  - “tiempo de denuncia” (SLA).
- **Salida**: reporte estructurado + paquete documental + próximos pasos + estimación de tiempos.

**Tools**
- `vision.detectDamage`, `vision.classifyDocument`, `vision.extractPlateVIN` (si aplica)
- `geo.reverseGeocode`, `geo.distanceCheck` (opcional)
- `policy.validateCoverage(event_type, policy_id)`
- `claim.createDraft`, `claim.attachEvidence`, `claim.generateReportPDF`
- `insurerApi.submitClaim` (si el broker/aseguradora lo permite)

**Guardrails**
- Nunca “aprobar” cobertura: solo “parece cubrir / no parece cubrir / requiere revisión” con evidencia.
- Si hay lesiones/fallecimiento: escalar inmediato + mensajes de contención.

---

#### 2.5 Orquestador (Cerebro)
**Responsabilidades**
- Routing inteligente + control de estado.
- Ensamblaje de contexto (RAG + datos vivos).
- Coordinación de workflows y consistencia.
- Políticas: qué tool puede usar cada agente y con qué datos.

**Componentes internos**
- `Intent Classifier` (LLM ligero + reglas)
- `Policy Engine` (determinístico, tipo OPA o reglas en código)
- `Workflow Engine` (Temporal recomendado)
- `Context Builder` (RAG con filtros multi-tenant)
- `Response Governor` (compliance + PII + “need-human-approval”)

---

### 3) Flujos end-to-end (paso a paso con decisiones del orquestador)

#### 3.1 Venta de póliza (lead → cotización → cierre → emisión)
1) Cliente escribe al WhatsApp del productor: “Necesito seguro para mi auto”.
2) Orquestador:
   - Intent: `sales_auto`
   - Verifica si es cliente existente (match teléfono/ID).
   - Si faltan datos: activa Agente Comercial (modo “recolección”).
3) Agente Comercial pide 3–5 datos mínimos (dominio, año/modelo, localidad, uso, suma/valor).
4) Orquestador llama `quoteEngine.simulate` + `insurerApi.getProducts` (si aplica).
5) Agente Comercial genera:
   - 2–3 opciones (económica / recomendada / premium),
   - bullets de diferencias reales (deducibles, granizo, asistencia),
   - CTA para cerrar.
6) Orquestador decide **requiere aprobación del productor** (por compliance): sí, si hay números finales.
7) Productor aprueba/edita desde web (Next.js) o responde “OK”.
8) Orquestador envía al cliente por WhatsApp.
9) Si el cliente acepta:
   - workflow de emisión: `insurerApi.createPolicy` o tarea interna.
10) Scheduler crea follow-ups automáticos (si no responde): 2h / 24h / 72h con copy distinto.

---

#### 3.2 Consulta de cliente vía WhatsApp (estado de póliza / dudas)
1) Cliente: “¿Mi póliza está vigente? No encuentro el PDF”.
2) Orquestador:
   - Intent: `policy_status`
   - Nivel de sensibilidad: medio
   - Autenticación: si coincide teléfono con titular → OK; si no → pregunta validación (DNI parcial/fecha nac).
3) Tool: `policy.getStatus` + `policy.getDocuments`.
4) Agente de Atención redacta respuesta humana + adjunta PDF si permitido.
5) Si la pregunta es compleja (“¿cubre X?”):
   - Orquestador llama `policy.validateCoverage` + RAG de condiciones,
   - Respuesta con “probable” + recomendación de confirmación,
   - Si ambigüedad alta, escala al productor con resumen.

---

#### 3.3 Denuncia de siniestro completa (WhatsApp → reporte → envío aseguradora)
1) Cliente: “Choqué recién”.
2) Orquestador:
   - Intent: `claim_new`
   - Detecta urgencia/lesiones con clasificador.
   - Si lesiones: handoff inmediato + checklist básico.
3) Agente de Siniestros inicia entrevista:
   - Qué pasó (tipo), cuándo, dónde, terceros, daños, heridos, denuncia policial.
4) Orquestador valida póliza (vigencia) y tipo de cobertura.
5) Solicita evidencias:
   - fotos (frente/atrás/laterales, patente, DNI, registro),
   - ubicación compartida (opcional),
   - datos de tercero.
6) Tools multimodales:
   - `vision.detectDamage` (resumen daños),
   - `vision.classifyDocument` (verifica legibilidad),
   - `geo.reverseGeocode` (normaliza dirección).
7) Orquestador arma `claimDraft` en Postgres + adjuntos en objeto storage.
8) Agente de Siniestros genera reporte estructurado (JSON) + explicación al cliente:
   - qué sigue, plazos, deducible estimado (si aplica).
9) Orquestador decide: **enviar a aseguradora automático** si:
   - documentación completa,
   - confianza alta,
   - reglas del broker lo permiten.
   Si no: crea tarea para productor/operador.
10) Cliente recibe confirmación + número de caso.

---

### 4) Stack tecnológico recomendado (con elecciones específicas)

#### Backend
- **NestJS** (monorepo con Nx opcional)
- **Postgres** (RDS/Aurora o Cloud SQL): multi-tenant con `tenant_id` en todas las tablas + RLS si se quiere endurecer.
- **Redis** (Elasticache/MemoryStore): sesiones, rate limits, locks, colas livianas.
- **Workflow**: **Temporal** (recomendado para siniestros y emisión) por reintentos, timers y trazabilidad.
- **Mensajería**: **Kafka** (si volumen alto) o **RabbitMQ** (más simple). Para MVP: Redis Streams puede alcanzar.

#### Vector DB / RAG
- **pgvector en Postgres** (decisión simple y deployable) para MVP y mediano plazo.
- Migración futura a Pinecone/Weaviate solo si escala/latencia lo exige.

#### Frontend
- **Next.js**:
  - Consola del productor: bandeja WhatsApp, aprobaciones, tareas, panel de ventas, reportes de siniestros.
  - Consola del broker: onboarding de productores, plantillas, playbooks, métricas.

#### Almacenamiento de archivos
- **S3-compatible** (AWS S3 / MinIO): pólizas, fotos, PDFs, reportes.
- Firmas temporales (pre-signed URLs) y cifrado.

#### IA / LLM
- **Proveedor LLM** (API) con:
  - modelos distintos por tarea (routing ligero vs redacción vs extracción),
  - **function calling** para tools,
  - **vision** para siniestros/documentos.
- **Observabilidad LLM**: OpenTelemetry + storage de “prompt/response” con redacción de PII.

#### WhatsApp
- **WhatsApp Cloud API** (Meta) + webhooks.
- Mensajes interactivos (botones), plantillas aprobadas para notificaciones.

#### Infraestructura (cloud)
- Kubernetes (EKS/GKE) o ECS/Cloud Run:
  - Para 30–60 días: **Docker + ECS/Cloud Run** (menos ops).
- CI/CD: GitHub Actions.
- Secrets: AWS Secrets Manager / GCP Secret Manager.

---

### 5) Ejemplo real de conversación por WhatsApp (siniestro auto)

**Cliente**: “Hola, choqué recién, soy Juan. ¿Qué hago?”  
**Copilot (Atención → Siniestros)**: “Juan, ¿estás bien? ¿Hay heridos?”  
**Cliente**: “No, solo daños.”  
**Copilot**: “Bien. Para ayudarte rápido necesito 4 datos: 1) ¿Cuándo fue? 2) ¿Dónde estás? (podés compartir ubicación) 3) ¿Qué pasó en una frase? 4) ¿Hay otro vehículo involucrado?”  
**Cliente**: “Hace 10 min, en Av. Libertador 1200 (te mando ubicación). Me chocaron de atrás. Sí, otro auto.”  
**Copilot**: “Perfecto. Ahora mandame por favor:  
- 4 fotos del auto (frente/atrás y laterales)  
- 1 foto donde se vea la patente  
- Datos del tercero (patente y compañía si la tenés)  
Si hay testigos o policía, decime.”  
**Cliente**: (envía fotos)  
**Copilot**: “Gracias. Veo daño en paragolpes trasero. ¿El auto puede circular? ¿Se abrió baúl o hay luces rotas?”  
**Cliente**: “Puede circular, luces ok.”  
**Copilot**: “Listo. Estoy armando la denuncia. Confirmame: ¿tu DNI termina en 34? (solo para validar identidad)”  
**Cliente**: “Sí.”  
**Copilot**: “Perfecto. Te paso un resumen para que confirmes:  
- Fecha/hora: 19:12  
- Lugar: Av. Libertador 1200, CABA  
- Hecho: colisión trasera con tercero  
- Daños: paragolpes trasero  
¿Está correcto? Respondé ‘Confirmo’ o corregime.”  
**Cliente**: “Confirmo.”  
**Copilot**: “Listo Juan. Caso #A-18422 creado. Próximo paso: si tenés, mandame foto del registro y cédula (puede ser una foto de cada uno). Si preferís, lo ve tu productor y te llama.”

---

### 6) Contratos JSON de entrada/salida entre agentes (ejemplos)

#### 6.1 Evento entrante desde WhatsApp → Orquestador
```json
{
  "event_id": "evt_01J...",
  "tenant_id": "broker_123",
  "producer_id": "prod_77",
  "channel": "whatsapp",
  "from": { "wa_id": "54911....", "display_name": "Juan" },
  "message": {
    "type": "text",
    "text": "Choqué recién, ¿qué hago?",
    "media": []
  },
  "timestamp": "2026-03-30T22:12:10Z"
}
```

#### 6.2 Solicitud del Orquestador → Agente (cualquier agente)
```json
{
  "trace_id": "tr_01J...",
  "tenant_id": "broker_123",
  "actor": { "producer_id": "prod_77", "customer_id": "cust_991" },
  "task": {
    "name": "claim_intake_step",
    "step": "collect_facts",
    "language": "es-AR"
  },
  "context": {
    "session_summary": "Cliente reporta choque reciente. Sin heridos.",
    "known_entities": {
      "policy_id": "pol_445",
      "product": "AUTO_TRC"
    },
    "retrieved_snippets": [
      { "doc_id": "cond_2025_auto", "text": "Plazo denuncia: 72h...", "score": 0.81 }
    ]
  },
  "constraints": {
    "tone": "humano_profesional",
    "must_ask": ["cuando", "donde", "que_paso", "heridos"],
    "must_not": ["prometer_cobertura"]
  }
}
```

#### 6.3 Respuesta del Agente → Orquestador (mensaje + acciones sugeridas)
```json
{
  "trace_id": "tr_01J...",
  "agent": "claims",
  "result": {
    "messages": [
      {
        "to": "customer",
        "type": "text",
        "text": "¿Estás bien? ¿Hay heridos? Para avanzar necesito: 1) ¿Cuándo fue? 2) ¿Dónde estás? (podés compartir ubicación) 3) ¿Qué pasó en una frase? 4) ¿Hay otro vehículo involucrado?"
      }
    ],
    "suggested_actions": [
      { "tool": "policy.validateCoverage", "args": { "policy_id": "pol_445", "event_type": "collision" } }
    ],
    "confidence": 0.84
  }
}
```

#### 6.4 Estructura del reporte de siniestro (salida final)
```json
{
  "claim_id": "clm_18422",
  "tenant_id": "broker_123",
  "policy_id": "pol_445",
  "insured": { "customer_id": "cust_991", "name": "Juan Pérez" },
  "event": {
    "type": "auto_collision",
    "datetime": "2026-03-30T19:12:00-03:00",
    "location": { "raw": "Av. Libertador 1200", "lat": -34.56, "lng": -58.44, "city": "CABA" },
    "narrative": "Tercero impacta desde atrás en semáforo."
  },
  "third_party": { "involved": true, "plate": "AB123CD", "notes": "Sin datos de compañía aún" },
  "damage": {
    "summary": "Paragolpes trasero con deformación",
    "vehicle_drivable": true,
    "vision_assessment": { "model": "vision_vX", "confidence": 0.78 }
  },
  "documents": [
    { "type": "photo_vehicle_rear", "object_key": "s3://.../rear.jpg" },
    { "type": "photo_plate", "object_key": "s3://.../plate.jpg" }
  ],
  "coverage_check": {
    "status": "likely_covered",
    "notes": "Cobertura colisión vigente. Deducible aplica según suma asegurada.",
    "requires_human_review": false
  },
  "next_steps": [
    "Solicitar registro y cédula",
    "Enviar a aseguradora si documentación completa"
  ],
  "audit": { "created_by": "ai", "approved_by_producer": false }
}
```

---

### 7) Inteligencia del sistema (LLM vs determinístico, ambigüedad, errores, validaciones)

- **LLM (sí)**:
  - clasificación de intención con contexto conversacional,
  - generación de preguntas mínimas para completar datos,
  - redacción persuasiva/comercial y tono,
  - resumen de pólizas/siniestros en lenguaje natural,
  - extracción “asistida” (cuando parser/OCR entrega texto ruidoso).
- **Determinístico (obligatorio)**:
  - permisos/roles/tenant isolation,
  - validación de identidad y acceso a datos,
  - elegibilidad/reglas duras de underwriting,
  - creación/actualización de póliza/siniestro en DB,
  - timers, reintentos, idempotencia, deduplicación,
  - auditoría y retención.

**Ambigüedad**
- Estrategia: “preguntas de desambiguación” + quick replies.
- Si el usuario mezcla temas (póliza + siniestro): el orquestador abre **dos hilos** (workflows) y prioriza urgencia (siniestro > ventas).

**Errores**
- Retries con backoff en tools externos.
- Fallback: si aseguradora API cae, crear “tarea pendiente” y avisar tiempos realistas.
- “Safe completion”: nunca bloquear al cliente; siempre dar siguiente paso manual.

**Validaciones críticas (siniestros)**
- Vigencia de póliza.
- Tipo de cobertura aplicable.
- Checklist documental según tipo (robo, granizo, terceros, RC).
- Señales de fraude (heurísticas): inconsistencias de hora/lugar, repetición, docs alterados (visión).

---

### 8) Escalabilidad, seguridad y negocio (B2B multi-tenant real)

#### Multi-tenant (broker → productores → clientes)
- `tenant_id` en todas las entidades.
- Config por tenant: productos habilitados, plantillas, tono, SLA, reglas de escalamiento.
- Separación por productor: visibilidad limitada (un productor no ve cartera de otro).

#### Seguridad / PII
- Cifrado en tránsito (TLS) y en reposo (KMS).
- Tokenización/mascarado de PII en logs.
- Acceso mínimo por tool (scopes).
- Retención configurable por tenant (compliance).

#### Logs y auditoría
- Trazas por `trace_id` y `event_id`.
- Guardar: acciones tool, decisiones del orquestador, “por qué escaló”, versiones de prompts, y “fuentes RAG” (doc_ids).
- Panel de auditoría para broker (quién vio qué, cuándo).

#### Escalabilidad horizontal
- Servicios stateless (NestJS) escalables.
- Redis/Temporal/Postgres gestionados.
- Colas para picos (WhatsApp bursts) y para OCR/visión.

---

### 9) Propuesta de valor (diferenciación vs Polko/Visred)

- **Aumenta ventas**:
  - cotizaciones más rápidas con menos ida y vuelta,
  - secuencias de follow-up automáticas personalizadas,
  - upsell/cross-sell basado en cartera real (y eventos: renovación, compra auto, nacimiento, etc.).
- **Reduce carga operativa**:
  - lectura y comparación de pólizas en minutos,
  - siniestros con entrevista guiada + armado automático de reporte y adjuntos,
  - auto-respuestas 24/7 con escalamiento inteligente.
- **Mejora imagen profesional**:
  - respuestas consistentes, claras, con tiempos y próximos pasos,
  - reportes prolijos y trazables,
  - “copiloto” que sugiere qué hacer (no solo registra).

---

### 10) KPIs (medibles y accionables)
- **Tiempo de primera respuesta (WA)**: p50/p95 por productor y por tenant.
- **Conversión lead→cotización** y **cotización→emisión**.
- **Tiempo medio a cotización** (desde primer mensaje hasta propuesta enviada).
- **% de conversaciones resueltas sin intervención humana** (por tipo: FAQ, estado, cobranza, siniestro).
- **% de siniestros con documentación completa en primer ciclo**.
- **Tasa de handoff** (y razones).
- **Retención de productores**: churn mensual, WAU/MAU productor, tiempo en app.
- **NPS interno del productor** (satisfacción con el copiloto).
- **Revenue uplift** estimado por cartera (primas emitidas vs baseline).

---

### 11) Riesgos y mitigaciones (producción)
- **Alucinación de coberturas**: mitigación con `policy.validateCoverage` determinístico + lenguaje “probable” + requirement de aprobación en mensajes sensibles.
- **Fugas multi-tenant**: mitigación con filtros obligatorios en cada query + RLS + tests de aislamiento + auditoría.
- **Errores en OCR/visión**: mitigación con `confidence` por campo + re-solicitud automática + handoff.
- **Dependencia de APIs de aseguradoras**: mitigación con “adapter layer” por aseguradora + colas + modo offline (tareas).
- **Fraude / abuso**: heurísticas + escalamiento + watermarking y detección de manipulación básica en docs.
- **Bloqueos por WhatsApp policies**: uso correcto de plantillas, opt-in, ventanas de 24h, fallback a email/SMS si el tenant lo permite.

---

### 12) Roadmap MVP (30–60 días) — enfocado y vendible

#### Días 0–30 (MVP funcional en producción controlada)
- **WhatsApp inbound/outbound** + bandeja en Next.js (básica).
- **Orquestador**: intent + routing a 2 agentes:
  - Atención (FAQ + estado de póliza)
  - Comercial (captura datos + propuesta simple)
- **Postgres**: clientes/pólizas/mensajes/tareas + multi-tenant.
- **RAG mínimo**: FAQ del broker + playbook comercial (pgvector).
- **Aprobación del productor**: antes de enviar cotizaciones.
- **Observabilidad**: trazas + auditoría + métricas base (tiempo respuesta, conversión).

#### Días 31–60 (diferenciación fuerte)
- **Siniestros v1** (entrevista guiada + reporte estructurado + adjuntos).
- **Analista de Pólizas v1** (PDF→extract→resumen + comparación simple).
- **Workflows con Temporal** (timers de follow-up y siniestros).
- **Integración 1 aseguradora** (adapter real) + “modo tarea” para el resto.
- **Panel de KPIs** para broker y productor (conversiones, SLA, automatización).
- **Seguridad hardening** (RLS, masking logs, roles finos, políticas tool).

---

Si querés, en el próximo paso lo bajo a un **blueprint de implementación** (esquema de servicios NestJS, modelo de datos Postgres con tablas clave y endpoints), ya alineado a tu workspace `Copilot-Seguros`.

---

**User**

si, pero arma todo, el modelo de la base de datos Postgres completo, no solo las tablas importantes, los endpoints correspondientes, tambien un docker (tene en cuenta que ya tengo uno levantado y quiero que sean independientes) para probar local antes de deployar,  la estructura de carpetas del repositorio del backend y frontend, una vez terminado eso segui con el frontend y la integracion/conexion con el backend, asi queda todo en el mismo workspace Copilot-Seguros

---

**Cursor**

### Resumen rápido

- Ya tienes un **monorepo completo** en `Copilot-Seguros` con:
  - **Backend NestJS** (`backend/`) con módulos básicos, esquema **Postgres multi-tenant completo** y endpoints iniciales.
  - **Frontend Next.js** (`frontend/`) con un **dashboard simple** que se conecta al backend (`/customers`).
  - **Docker Compose independiente** (`docker-compose.yml`) con Postgres (puerto 5433), Redis (6380), backend (4000) y frontend (3000).

---

### 1. Modelo completo de base de datos Postgres

En `backend/db-schema.sql` tienes el esquema relacional multi-tenant con todas las piezas clave:

- **Identidad y multi-tenant**
  - `tenants`: brokers.
  - `users`: usuarios internos (roles `BROKER_ADMIN`, `PRODUCER`).
  - `producers`: perfil extendido de productor.

- **Clientes y canales**
  - `customers`: clientes finales.
  - `whatsapp_contacts`: vínculo WhatsApp ↔ customer/productor.

- **Core asegurador**
  - `insurers`: compañías.
  - `products`: productos.
  - `policies`: pólizas.
  - `policy_documents`: PDFs y documentos asociados.

- **Siniestros**
  - `claims`: siniestros.
  - `claim_events`: timeline estructurado.
  - `claim_documents`: evidencias (fotos, PDFs, etc.).

- **Conversaciones y tareas**
  - `conversations`: hilos (principalmente WhatsApp).
  - `messages`: mensajes individuales.
  - `tasks`: tareas internas (follow-ups, revisiones).

- **Conocimiento**
  - `faq_articles`: FAQ por tenant.
  - `embeddings` comentado (para pgvector).

Para preparar la DB local:

```bash
docker compose up -d copilot_db
# luego, desde el host o contenedor:
psql -h localhost -p 5433 -U copilot -d copilot_seguros -f backend/db-schema.sql
```

---

### 2. Estructura de carpetas del repositorio

**Root**

- `README.md`
- `docker-compose.yml`
- `backend/`
- `frontend/`

**Backend (`backend/`)**

- `package.json`, `tsconfig.json`, `nest-cli.json`, `Dockerfile`
- `db-schema.sql`
- `src/`
  - `main.ts` – arranque Nest.
  - `app.module.ts` – wiring de módulos y TypeORM.
  - `modules/`
    - `tenants/`
      - `tenant.entity.ts`
      - `tenants.module.ts`
      - `tenants.service.ts`
      - `tenants.controller.ts` (`GET /tenants`)
    - `users/`
      - `user.entity.ts`
      - `users.module.ts`
      - `users.controller.ts` (`GET /users/me` stub)
    - `producers/`
      - `producers.module.ts` (stub, listo para agregar entidades/controladores)
    - `customers/`
      - `customer.entity.ts`
      - `dto/create-customer.dto.ts`
      - `customers.module.ts`
      - `customers.service.ts`
      - `customers.controller.ts`
        - `GET /customers` – lista todos (MVP).
        - `POST /customers` – crea cliente (por ahora usa un `DUMMY_TENANT_ID` hasta que metas auth multi-tenant real).
    - `policies/`
      - `policies.module.ts` (stub para endpoints de pólizas).
    - `claims/`
      - `claims.module.ts` (stub para endpoints de siniestros).
    - `conversations/`
      - `conversations.module.ts` (stub para inbox WA, conversaciones, mensajes).
    - `orchestrator/`
      - `orchestrator.module.ts`
      - `orchestrator.controller.ts`
        - `POST /orchestrator/whatsapp/webhook` – stub inicial para recibir webhooks de WhatsApp.

**Frontend (`frontend/`)**

- `package.json`, `tsconfig.json`, `next.config.mjs`, `Dockerfile`
- `app/`
  - `layout.tsx` – layout general, header “Copilot Seguros”.
  - `page.tsx` – dashboard básico que consulta al backend.
  - `globals.css` – estilos globales (pensados para Tailwind; puedes añadir `tailwind.config` cuando lo necesites).

---

### 3. Docker local (independiente del que ya tienes)

Archivo: `docker-compose.yml` en raíz.

Servicios:

- `copilot_db` (Postgres 16)
  - Puerto host: **5433** → contenedor 5432 (para no pisar tu otro Postgres).
  - Credenciales: `copilot` / `copilot_pass`, DB `copilot_seguros`.

- `copilot_redis` (Redis 7)
  - Puerto host: **6380** (para que tampoco choque con otro Redis).

- `copilot_backend` (NestJS)
  - Build desde `backend/Dockerfile`.
  - Expone puerto **4000**.
  - Variables de entorno ya apuntan al servicio `copilot_db` y `copilot_redis`.

- `copilot_frontend` (Next.js)
  - Build desde `frontend/Dockerfile`.
  - Expone puerto **3000**.
  - Usa `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`.

Levantar todo:

```bash
docker compose up --build
```

---

### 4. Backend – endpoints iniciales y cómo se conectan al modelo

**Configuración de TypeORM** (`AppModule`):

- Se conecta a Postgres con:
  - host: `DB_HOST` (en Docker: `copilot_db`).
  - puerto: `DB_PORT` (5432 en contenedor, 5433 en host).
- `autoLoadEntities: true`, `synchronize: false` (usa el `db-schema.sql`).

**Módulo `Tenants`**

- Entidad `Tenant` mapea tabla `tenants`.
- Endpoint:
  - `GET /tenants`: lista todos los tenants (útil para probar conexión a DB).

**Módulo `Users`**

- Entidad `User` mapea tabla `users` (sin lógica aún).
- Endpoint:
  - `GET /users/me`: stub (devuelve mensaje fijo, listo para enganchar JWT/sesiones luego).

**Módulo `Customers`**

- Entidad `Customer` mapea `customers`.
- DTO `CreateCustomerDto` con validación.
- Service:
  - `findAll()`
  - `create(tenantId, dto)`
- Controller:
  - `GET /customers`: devuelve todos los clientes (MVP, sin paginación todavía).
  - `POST /customers`: crea un cliente con un `tenantId` dummy (luego lo reemplazas por tenant real desde auth/headers).

**Módulo `Orchestrator`**

- `POST /orchestrator/whatsapp/webhook`:
  - De momento solo hace eco del payload.
  - Punto perfecto para ir metiendo el **router de intenciones** y el **multi-agente** más adelante.

**Stubs preparados**

- `ProducersModule`, `PoliciesModule`, `ClaimsModule`, `ConversationsModule` ya declarados para que no fallen importaciones y puedas ir llenándolos:
  - `Policies`: endpoints tipo `GET /policies`, `GET /policies/:id`, `GET /customers/:id/policies`.
  - `Claims`: `POST /claims`, `GET /claims/:id`, `POST /claims/:id/submit`.
  - `Conversations`: `GET /conversations`, `GET /conversations/:id/messages`.

---

### 5. Frontend – integración con el backend

En `frontend/app/page.tsx`:

- Usa `axios` y `NEXT_PUBLIC_API_BASE_URL` para llamar al backend:

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const res = await axios.get<Customer[]>(`${API_BASE}/customers`);
```

- Muestra una **tabla simple** con:
  - Nombre
  - Email
  - WhatsApp

Este dashboard ya comprueba el ciclo:

1. Frontend Next.js (3000) → `GET /customers` al backend (4000).
2. Backend NestJS → `CustomersService` → Postgres.
3. Respuesta renderizada en el dashboard.

---

### 6. Cómo probar todo el flujo local

1. **Instalar dependencias** (si quieres correr sin Docker):

```bash
cd backend
npm install
cd ../frontend
npm install
```

2. **Levantar Postgres/Redis con Docker únicamente**:

```bash
docker compose up -d copilot_db copilot_redis
psql -h localhost -p 5433 -U copilot -d copilot_seguros -f backend/db-schema.sql
```

3. **Arrancar backend**:

```bash
cd backend
npm run start:dev
# → http://localhost:4000
```

4. **Arrancar frontend**:

```bash
cd ../frontend
npm run dev
# → http://localhost:3000
```

5. **Crear un cliente de prueba**:

```bash
curl -X POST http://localhost:4000/customers \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Juan Pérez","email":"juan@example.com","phoneWhatsapp":"+5493541671944"}'
```

6. Refresca `http://localhost:3000` y deberías ver el cliente en la tabla.

---

### 7. Siguientes pasos (para ir hacia el sistema multi-agente completo)

Si te parece bien, en el siguiente paso puedo:

- Extender los **endpoints** para:
  - Pólizas (`/policies`), siniestros (`/claims`), conversaciones (`/conversations`, `/messages`).
  - Endpoints específicos del **Agente de Siniestros** y del **Orquestador** (por ejemplo, `/orchestrator/claims/intake`).
- Empezar a armar los **contratos JSON** internos como DTOs Nest y controladores dedicados al sistema multi-agente.
- Añadir **Tailwind** y vistas en Next.js para:
  - Inbox estilo WhatsApp.
  - Listado/detalle de pólizas.
  - Listado/detalle de siniestros.

---

**User**

ok perfecto, instale todo, pero con dockr veo en consola el siguiente error,
[+] Running 4/4
 ✔ Network copilot-seguros_copilot_net       Created                                                               0.1s 
 ✔ Volume "copilot-seguros_copilot_db_data"  Created                                                               0.0s 
 ✔ Container copilot_seguros_redis           Started                                                               0.4s 
 ✔ Container copilot_seguros_db              Started                                                               0.4s 
psql: error: connection to server at "localhost" (127.0.0.1), port 5433 failed: server closed the connection unexpectedly
        This probably means the server terminated abnormally
        before or while processing the request.

---

**Cursor**

Voy a revisar el log del contenedor de Postgres y el estado de los servicios para ver por qué Postgres se está cayendo (eso es lo que provoca el “server closed the connection unexpectedly”). Luego ajusto el `docker-compose.yml` si hace falta (healthcheck, volumen, permisos) y te dejo el comando exacto para inicializar el esquema sin errores.

El comando se ejecutó bien, pero `psql` intentó conectarse cuando Postgres todavía no estaba listo o el contenedor se cayó al arrancar. Ahora reviso el estado y logs del contenedor `copilot_seguros_db` para ver la causa exacta y lo corregimos.

El contenedor de Postgres **está arriba**; el error vino porque `psql` intentó conectar **demasiado rápido** (durante el primer `initdb`) y/o porque todavía no existía un tenant válido para el `tenant_id` dummy del backend. Lo dejo resuelto de forma “productiva para local”: Postgres con **healthcheck + wait**, y un **init script** que crea el esquema y un tenant fijo para que `POST /customers` funcione sin tocar nada más.

Listo: **Postgres ya no se cae** y además ahora se inicializa solo con el esquema + un **tenant demo** (el UUID `000...000`) para que el backend pueda crear `customers` sin chocar con la FK.

Ahora te está fallando otra cosa distinta: el `docker compose up --build` no puede escribir en buildx (`permission denied` en `~/.docker/buildx/...`). Eso suele pasar por permisos del home o por buildx/bake habilitado.

### Solución inmediata (sin buildx/bake)
Corré esto desde la raíz del repo:

```bash
COMPOSE_BAKE=false DOCKER_BUILDKIT=0 docker compose up -d --build
```

Si igual falla, probá construyendo por separado:

```bash
COMPOSE_BAKE=false DOCKER_BUILDKIT=0 docker compose build
docker compose up -d
```

### Verificación rápida
Cuando levante, esto tiene que funcionar:

```bash
curl http://localhost:4000/tenants
curl http://localhost:4000/customers
```

### Qué cambié para arreglar tu error original (psql)
- **Healthcheck** en `copilot_db` + `depends_on` con `service_healthy` para que el backend espere a Postgres.
- **Init automático** en `./backend/db/init/001-schema-and-seed.sql` montado en `/docker-entrypoint-initdb.d/`, así el esquema se carga solo al crear el volumen.
- Seed de `tenants` con el UUID dummy `00000000-0000-0000-0000-000000000000`.

Si me pegás la salida de:

```bash
ls -ld ~/.docker ~/.docker/buildx ~/.docker/buildx/refs
```

te digo cuál es la causa exacta del `permission denied` y lo dejamos permanente, pero con el comando de arriba deberías poder seguir ya mismo.

---

**User**

pero espera, esto levanta todo el Backend no me interesa, quiero solo la base y redis, el backend y el front lo levanto con un run local para debug, entiendo que la base y redis ya estan arriba por lo tanto deberia correr el backend, con un curl o postman intentar crear un usuario, si eso da ok levanto el Frontend

---

**Cursor**

Perfecto: dejemos **solo Postgres + Redis en Docker**, y el **backend/frontend corriendo local** para debug. Ahora mismo tu Docker ya tiene `copilot_db` y `copilot_redis` listos; lo que falta es que el backend tenga un **endpoint real para crear usuario**, porque hoy `GET /users/me` es un stub.

Voy a agregar `POST /users` (crea usuario con password hasheada) y dejar el backend listo para apuntar a `localhost:5433` y Redis `localhost:6380`.

### Hecho: Docker solo DB + Redis, y backend local con endpoint real para crear usuarios

#### 1) Levantar **solo** Postgres + Redis (Docker)
Desde la raíz:

```bash
docker compose up -d copilot_db copilot_redis
docker compose ps
```

- Postgres queda en **`localhost:5433`**
- Redis queda en **`localhost:6380`**
- La DB se inicializa sola (schema + tenant demo) por el init script `backend/db/init/001-schema-and-seed.sql`.

#### 2) Correr el **backend local** para debug (sin Docker)
En otra terminal:

```bash
cd backend
npm run start:dev
```

Asegurate de exportar estas vars (si no las tenés ya):

```bash
export DB_HOST=localhost
export DB_PORT=5433
export DB_USER=copilot
export DB_PASSWORD=copilot_pass
export DB_NAME=copilot_seguros
export REDIS_HOST=localhost
export REDIS_PORT=6380
export PORT=4000
```

#### 3) Probar con curl/Postman: **crear usuario**
Ya agregué un endpoint real:

- **POST** `http://localhost:4000/users`
- Header opcional: **`x-tenant-id`** (si no lo mandás usa el tenant demo `00000000-0000-0000-0000-000000000000`)
- Body:

```json
{
  "email": "admin@demo.com",
  "password": "SuperSecreta123",
  "role": "BROKER_ADMIN",
  "displayName": "Admin Demo"
}
```

Ejemplo con `curl`:

```bash
curl -X POST http://localhost:4000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"SuperSecreta123","role":"BROKER_ADMIN","displayName":"Admin Demo"}'
```

Si eso responde 200 con el usuario (sin `passwordHash`), estás listo para levantar el frontend local.

#### 4) Qué cambié
- **DB/Redis Docker**: ya estaban OK; el error original era timing. Ahora Postgres tiene **healthcheck** + init automático.
- **Backend**: agregué `bcryptjs` y `POST /users` (crea usuario con password hasheada).

Cuando confirmes que `POST /users` te da OK, sigo con el **frontend local** y la integración completa (login básico + llamadas tipadas a endpoints).

---

**User**

ok antes de seguir, respecto a los agentes, el RAG lo podemos hacer con Langchain ?

---

**Cursor**

### Sí, se puede (y encaja bien), pero con una decisión clara

**Sí: podemos hacer el RAG con LangChain**, especialmente para acelerar el armado de pipelines (retriever + re-ranking + prompt templates + output parsers). En este proyecto (NestJS + multi-tenant) lo más realista es usar **LangChain.js** como **librería interna** dentro del backend.

### Cómo lo haría en este stack (concreto)
- **Backend NestJS**:
  - Un módulo `rag/` que expone un servicio `RagService` con métodos tipo:
    - `retrieve({ tenantId, producerId?, customerId?, query, filters })`
    - `answer({ query, retrievedDocs, policy })`
  - LangChain se usa para:
    - **Chunking** (PDF/FAQ/Playbooks) + embeddings
    - **VectorStore** (recomendado: `pgvector` en Postgres para mantener todo simple)
    - **Retriever** con filtros obligatorios por `tenant_id` (y opcional por `customer_id`, `policy_id`)
    - (Opcional) **re-ranker** si ves ruido en resultados

### Puntos críticos (multi-tenant) que no negocio
- **Filtros por tenant siempre determinísticos**, no “dejados” al LLM.
- **IDs y trazabilidad**: cada doc recuperado debe venir con `doc_id`, `source_type`, `source_id` para auditoría.
- **No mezclar memoria**: conversación (Redis) ≠ conocimiento (VectorDB) ≠ datos operativos (Postgres tablas core).

### Cuándo NO usaría LangChain
- Si querés el mínimo posible de dependencias y máxima transparencia: implementamos RAG “a mano” (SQL + embeddings + prompt).
- Si vas a usar un proveedor que ya da “retrieval” gestionado y no querés operar vector store.

### Mi recomendación para Copilot-Seguros
- **LangChain.js + pgvector** (en el mismo Postgres) para MVP y producción inicial.
- Mantener el “core” del orquestador independiente: LangChain solo como **capa de retrieval/QA**, no como framework que controle toda la app.

Si te parece, el siguiente paso es que definamos el **contrato** de `RagService` (inputs/outputs) y el **modelo de tablas de embeddings** (o `documents + chunks + embeddings`) para que sea multi-tenant y auditable.

---

**User**

ok  entiendo, perfecto, vamos con tu propuesta y definamos el contrato de RagService (inputs/outputs) y el modelo de tablas de embeddings para que sea multi-tenant y auditable

---

**Cursor**

Definiendo el contrato de `RagService` y el esquema de tablas para RAG multi-tenant y auditable; integrándolo en el repositorio (SQL + módulo NestJS).



Implementando el esquema SQL con pgvector (ajustando la imagen de Postgres en Docker), los contratos TypeScript de `RagService` y un módulo Nest con implementación stub lista para conectar LangChain.



Corrigiendo el SQL del trigger (compatibilidad PostgreSQL) y eliminando el CHECK inútil.



Resumen de lo que quedó definido e implementado en el repo:

---

### Contrato `RagService` (TypeScript)

Archivo: `backend/src/modules/rag/contracts/rag.contracts.ts`

- **`RAG_SERVICE`**: token para inyección (`@Inject(RAG_SERVICE)`).
- **`IRagService`**:
  - `indexDocument(input: RagIndexDocumentInput): Promise<RagIndexDocumentResult>`
  - `retrieve(input: RagRetrieveInput): Promise<RagRetrieveResult>`
  - `softDeleteDocument(tenantId, documentId, actorUserId?): Promise<void>`

**Indexación** — `RagIndexDocumentInput`:

- Obligatorios: `tenantId`, `scope`, `sourceType`, `fullText`, `embeddingModel`.
- Opcionales: `sourceRef`, `title`, `locale`, `chunking`, `embeddingDimensions`, `createdByUserId`, `producerId`, `customerId`, `policyId`, `meta`.

**Resultado index** — `RagIndexDocumentResult`:

- `documentId`, `chunkIds[]`, `contentSha256`, `chunkCount`.

**Retrieval** — `RagRetrieveInput`:

- `query`, `filters` (mínimo `tenantId`; opcional `producerId`, `customerId`, `policyId`, `scopes[]`).
- Opcional: `topK`, `minScore`, `embeddingModel`, `traceId`, `audit` (`actorType`, `actorId`, `skipPersistence`).

**Resultado retrieve** — `RagRetrieveResult`:

- `chunks[]` (`RetrievedChunk`: ids, `scope`, `content`, `score`, `chunkIndex`, metadatos, `embeddingModel`).
- `usedFilters`, `latencyMs`.

**Utilidad**: `fingerprintQuery()` en `rag.service.ts` para auditoría sin guardar texto crudo (SHA-256 del query normalizado).

Módulo Nest: `RagModule` (global) + `RagService` stub: `retrieve` devuelve `[]`; `indexDocument` y `softDeleteDocument` lanzan `NotImplementedException` hasta cablear LangChain + SQL.

---

### Modelo de tablas (Postgres + pgvector, multi-tenant y auditable)

Archivo: `backend/db/init/002-rag-pgvector.sql`

| Tabla | Rol |
|--------|-----|
| **`rag_documents`** | Documento lógico por `tenant_id`; scopes (`FAQ`, `PLAYBOOK`, `POLICY_DOCUMENT`, etc.); opcional `producer_id`, `customer_id`, `policy_id`; `source_type`, `source_ref`, `content_sha256`, `meta`, `deleted_at` (soft delete). |
| **`rag_chunks`** | Fragmentos con **`embedding vector(1536)`**, `embedding_model`, `embedding_dimensions`; `tenant_id` denormalizado; **trigger** que exige `tenant_id` = del documento. Índice **HNSW** coseno. |
| **`rag_index_events`** | Auditoría de indexación: `DOCUMENT_CREATED`, `CHUNKS_WRITTEN`, `REINDEXED`, `SOFT_DELETED`, `HARD_DELETED` + `details` JSONB. |
| **`rag_retrieval_logs`** | Auditoría de consultas: `trace_id`, `actor_type`/`actor_id`, `query_fingerprint`, `query_text_redacted` opcional, `filters`, `top_chunk_ids`, `top_scores`, `latency_ms`. |

`docker-compose.yml`: imagen de DB cambiada a **`pgvector/pgvector:pg16`** para poder hacer `CREATE EXTENSION vector`.

**Importante**: si ya tenías volumen con Postgres “vanilla”, hay que **recrear volumen** para que corran `001` + `002`, o aplicar `002-rag-pgvector.sql` a mano sobre una instancia con pgvector.

---

### Archivos tocados

- `backend/db/init/002-rag-pgvector.sql` — esquema RAG.
- `backend/src/modules/rag/contracts/rag.contracts.ts` — contrato.
- `backend/src/modules/rag/rag.service.ts` — stub + `fingerprintQuery`.
- `backend/src/modules/rag/rag.module.ts` — módulo global.
- `backend/src/app.module.ts` — import de `RagModule`.
- `backend/db-schema.sql` — referencia al init RAG.
- `docker-compose.yml` — imagen pgvector.
- `README.md` — nota de volumen / init.

El siguiente paso natural es implementar `indexDocument`/`retrieve` con **LangChain.js** + consultas SQL filtradas por `tenant_id` e inserción en `rag_retrieval_logs` cuando `audit.skipPersistence` sea falso. Si querés, en el siguiente mensaje lo implementamos ya con `@langchain/community` + `PGVectorStore` (o SQL raw con `pg`).

