# PRD — agent-reporter

**Estado:** Borrador v0.2
**Owner:** manelet
**Fecha:** 2026-05-07

---

## 1. Resumen

`agent-reporter` es un servicio que recolecta información periódica desde distintas **fuentes** (Sentry, Mixpanel, GitHub Actions, APIs propias) y envía **reportes** a distintos **canales** (email, Telegram). La configuración (qué reportar, cuándo, a dónde) se gestiona desde un **panel de admin** propio respaldado por una base de datos local (PocketBase).

El objetivo es tener un único lugar donde definir "todos los lunes a las 9am, mándame por Telegram las issues nuevas de Sentry del último día", sin tener que escribir un script ad-hoc por cada combinación.

---

## 2. Objetivos y no-objetivos

### Objetivos
- Definir una arquitectura clara de **Source → Report → Channel** que permita añadir nuevas fuentes/canales sin tocar el core.
- Soportar al menos las fuentes y canales del MVP (ver §4).
- Que cualquier reporte se pueda programar (cron) o disparar manualmente.
- Panel de admin para CRUD de fuentes, canales, reportes, y para inspeccionar runs históricos.
- Stack TypeScript end-to-end (backend + frontend admin).
- Despliegue simple: un proceso Node + un binario PocketBase. Nada de Docker compose con N servicios.

### No-objetivos (por ahora)
- Multi-tenant / multi-usuario (es uso personal de manelet).
- Editor visual de templates de reporte. Los templates serán código.
- Dashboards en tiempo real / streaming. Esto es batch.
- Reemplazar herramientas como Datadog/Grafana. No es observability, es resumen/notificación.

---

## 3. Usuario

Una sola persona (manelet). Usa el panel admin para configurar qué quiere recibir y dónde. Recibe reportes en sus canales personales.

---

## 4. Conceptos del dominio

Para que el sistema sea extensible, todo gira alrededor de cuatro entidades:

- **Source (Fuente):** una integración que sabe obtener datos de un sistema externo. Puede ser **pull** (hace fetch cuando el report lo pide, ej. Sentry, Mixpanel, custom-api) o **push** (recibe webhooks entrantes, ej. GitHub Actions). Tiene credenciales y un tipo (`sentry`, `mixpanel`, `github-actions`, `custom-api`).
- **Channel (Canal):** una integración que sabe entregar contenido. Tiene credenciales y un tipo (`email`, `telegram`).
- **Report (Reporte):** une una `Source` con uno o más `Channel`. Define qué consultar (params), cómo formatearlo (template id), y cuándo dispararlo (cron para pull / webhook para push).
- **Run (Ejecución):** la ejecución concreta de un reporte. Guarda timestamp, status, payload generado, errores, y a qué canales se entregó.

```
       pull (cron)                                          deliver
┌──────────┐ ────fetch───> ┌──────────┐ ──render──> ┌──────────┐ ──> ┌──────────┐
│  Source  │               │  Report  │             │ Template │     │ Channel  │
└──────────┘               └──────────┘             └──────────┘     └──────────┘
       push (webhook)            │
┌──────────┐ ────POST────>       └─> Run (historial)
└──────────┘
```

### 4.1 Sources del MVP

| Tipo            | Modo  | Qué obtiene                                                                | Auth                       |
|-----------------|-------|----------------------------------------------------------------------------|----------------------------|
| `sentry`        | pull  | Issues nuevas/regressions en un proyecto en las últimas 24h               | Auth token + org/project   |
| `mixpanel`      | pull  | Resultado de una **query JQL custom** definida en el admin                | Service account + project  |
| `github-actions`| push  | Eventos `workflow_run` recibidos por webhook desde GitHub                 | Webhook secret (HMAC)      |
| `custom-api`    | pull  | Llamada HTTP a un endpoint propio que devuelve JSON estándar (ver §5.1)   | Bearer token configurable  |

### 4.2 Channels del MVP

| Tipo       | Cómo entrega                              | Auth                      |
|------------|-------------------------------------------|---------------------------|
| `email`    | Resend API                                | API key                   |
| `telegram` | Bot API → chat id                         | Bot token + chat id       |

---

## 5. Requisitos funcionales

### 5.1 Formato JSON estándar para `custom-api`

Para que el reporter sepa cómo formatear lo que llega de una API propia sin lógica custom por endpoint, los endpoints deben devolver:

```json
{
  "title": "Daily build summary",
  "generated_at": "2026-05-06T08:00:00Z",
  "summary": "3 deploys, 1 fallo",
  "sections": [
    {
      "heading": "Deploys",
      "items": [
        { "label": "api v1.2.3", "value": "ok", "url": "https://..." }
      ]
    }
  ],
  "metrics": [
    { "label": "Errors p95", "value": 12, "delta": "+3" }
  ]
}
```

El renderer convierte esto a HTML (email) o Markdown (Telegram).

### 5.2 Triggers
Un `Report` tiene un `trigger` que depende del modo de su source:
- **Sources pull** (`sentry`, `mixpanel`, `custom-api`) → trigger `cron`. Campo `cron` obligatorio (ej. `0 9 * * *`). Timezone fijo `Europe/Madrid`.
- **Sources push** (`github-actions`) → trigger `webhook`. Cada report expone una URL única `POST /webhooks/:reportId` con un secret HMAC para verificar el origen. No hay cron.
- En ambos modos hay botón **"Run now"** en el admin (con datos mock cuando es webhook, ver §5.7).
- El scheduler corre dentro del proceso Node con `node-cron`. No hay worker separado en el MVP.

### 5.3 Ventana fija de 24h
Para sources pull, el fetch siempre cubre **las últimas 24h** desde el momento de ejecución. No guardamos cursor entre runs. Razón: simplicidad — si un run falla y no se recupera, el siguiente cubrirá los últimos 24h igualmente, y los reports diarios no tienen huecos. La única consecuencia: si dos runs se ejecutan en menos de 24h pueden solapar items, pero como son notificaciones humanas (no datos transaccionales) es aceptable.

### 5.4 Skip empty reports
Si tras el fetch + filtrado no hay nada que reportar, el run **NO se entrega a los canales**. El run igualmente se guarda con `status = skipped` y queda visible en el historial. Cada template implementa `shouldDeliver(data): boolean` para decidir.

### 5.5 Templates
- Cada `Report` referencia un template (string id, ej. `sentry-daily`, `gh-actions-workflow-failure`).
- Los templates viven en código (`src/templates/*.ts`), no en DB. Razón: testeables, versionados con git, sin sandbox de ejecución.
- Cada template exporta `shouldDeliver(data)`, `renderEmail(data)`, `renderTelegram(data)`, y un `mockData()` para previsualización.

### 5.6 Panel de admin
SPA custom desde día 1. Idioma: **inglés**. Vistas:
- **Sources**: lista, crear, editar, test connection. Para `mixpanel`, editor de JQL en el form (textarea con resaltado básico, validación al guardar).
- **Channels**: lista, crear, editar, enviar mensaje de prueba.
- **Reports**: lista, crear (elegir source → según el modo de la source el form muestra `cron` o auto-genera URL+secret de webhook → elegir channels → elegir template → params), editar, run-now, ver últimos runs.
- **Runs**: historial cronológico, filtrable por reporte; detalle muestra payload bruto, contenido renderizado, status por canal, error si lo hubo. Estado `skipped` claramente diferenciado de `success`/`failed`.
- **Template preview**: ruta dedicada para cada template (`/templates/:id/preview`) que muestra el render de email + telegram con `mockData()`. Útil para iterar sin disparar runs reales.

Auth del admin: una sola contraseña (la de PocketBase). No hay multi-user.

### 5.7 Manejo de errores
- Si un fetch falla, el run queda en `failed` con el error guardado. No hay retry automático en MVP.
- Si la entrega a un canal falla, el run es `partial` (puede haber tenido éxito en otros canales).
- Errores se notifican opcionalmente a un canal "fallback" configurable (típicamente Telegram al propio manelet).

### 5.8 Cifrado de secrets
Las credenciales de sources y channels (auth tokens, API keys, bot tokens, webhook secrets) se guardan **cifradas** en los campos `config` de la DB.
- Algoritmo: AES-256-GCM (`node:crypto`).
- Master key en variable de entorno `AGENT_REPORTER_MASTER_KEY` (32 bytes hex). Sin esa key el proceso no arranca.
- En el admin, los formularios muestran los secrets enmascarados (`••••••`) salvo cuando el usuario hace click en "Reveal" / "Edit", momento en que el backend desencripta y devuelve el plaintext.
- Backups: el `.db` contiene los secrets cifrados, lo cual es seguro mientras la master key se guarde aparte.

---

## 6. Arquitectura técnica

### 6.1 Stack
- **Lenguaje:** TypeScript en todo (backend + admin).
- **Backend:** Node.js + Hono (HTTP). Endpoints CRUD para el admin + endpoint público `POST /webhooks/:reportId`.
- **DB:** **PocketBase** (binario local en dev; binario en VPS en prod). El backend habla con PocketBase vía SDK; el admin habla con el backend (no directo a PocketBase) para centralizar auth, cifrado y validación.
- **Admin frontend:** SPA en React + Vite + TanStack Query. Tailwind para estilos. UI en inglés.
- **Scheduler:** `node-cron` dentro del proceso backend, TZ `Europe/Madrid`.
- **Email:** Resend (SDK oficial).
- **Validación:** zod en boundaries (config de sources/channels, payloads de custom-api, payloads de webhooks).
- **Cifrado:** `node:crypto` AES-256-GCM con master key en env (`AGENT_REPORTER_MASTER_KEY`).

### 6.2 Por qué PocketBase y no Appwrite
| Criterio              | PocketBase                          | Appwrite                                    |
|-----------------------|-------------------------------------|---------------------------------------------|
| Despliegue            | 1 binario Go + SQLite               | Docker compose, múltiples containers        |
| Footprint             | ~30MB RAM                           | ~1GB+ RAM                                    |
| Admin UI built-in     | Sí, completo                        | Sí, completo                                 |
| SDK TypeScript        | Oficial, simple                     | Oficial, más features                        |
| Backups               | Copia de un archivo `.db`           | Volúmenes Docker                             |
| Self-host coste       | Trivial (cualquier VPS pequeño)     | Requiere más recursos                        |
| Features que NO uso   | —                                   | Functions, Storage avanzado, Realtime, etc.  |

Para un servicio personal con ~5-6 colecciones, PocketBase es claramente la opción correcta. Appwrite tendría sentido si en el futuro el proyecto se abriera a multi-tenant, pero ese caso ya está fuera del scope (§2).

> **Decisión propuesta:** PocketBase. Confirmar antes de empezar.

### 6.3 Estructura de proyecto
```
agent-reporter/
├── apps/
│   ├── server/              # Backend Node + Hono
│   │   ├── src/
│   │   │   ├── sources/     # 1 carpeta por tipo de source
│   │   │   ├── channels/    # 1 carpeta por tipo de channel
│   │   │   ├── templates/   # renderers
│   │   │   ├── scheduler.ts
│   │   │   ├── runner.ts    # orquesta source → render → channel → run
│   │   │   └── api/         # endpoints HTTP que consume el admin
│   │   └── package.json
│   └── admin/               # SPA React + Vite
│       └── package.json
├── packages/
│   └── shared/              # tipos compartidos (zod schemas, DTOs)
├── pb_data/                 # data dir de PocketBase (gitignored)
├── pocketbase               # binario (gitignored, se baja en setup)
├── docs/
│   └── PRD.md
└── package.json             # workspace root (pnpm)
```

### 6.4 Interfaces de extensión

```ts
// Source pull (fetch on demand): Sentry, Mixpanel, custom-api
interface PullSourceAdapter<TConfig, TData> {
  type: string;
  mode: "pull";
  configSchema: ZodSchema<TConfig>;
  fetch(config: TConfig, params: ReportParams, window: TimeWindow): Promise<TData>;
  testConnection(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

// Source push (receives webhook): GitHub Actions
interface PushSourceAdapter<TConfig, TData> {
  type: string;
  mode: "push";
  configSchema: ZodSchema<TConfig>;
  // Verifica firma HMAC y parsea el payload. Devuelve null si el evento debe ignorarse.
  parseWebhook(
    config: TConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<TData | null>;
}

// Cada channel implementa:
interface ChannelAdapter<TConfig> {
  type: string;
  configSchema: ZodSchema<TConfig>;
  deliver(config: TConfig, content: RenderedContent): Promise<void>;
  testDelivery(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

// Cada template implementa:
interface ReportTemplate<TData> {
  id: string;
  sourceType: string;                // qué source espera
  shouldDeliver(data: TData): boolean; // false → run queda como `skipped`
  mockData(): TData;                 // para preview en admin
  renderEmail(data: TData): { subject: string; html: string };
  renderTelegram(data: TData): string; // markdown
}
```

Añadir un nuevo source/channel/template = un archivo nuevo + registrarlo en un index. No tocar el runner.

---

## 7. Modelo de datos (PocketBase)

### `sources`
| campo        | tipo        | notas                                 |
|--------------|-------------|---------------------------------------|
| id           | string      |                                       |
| name         | string      | nombre humano                         |
| type         | enum        | `sentry` \| `mixpanel` \| ...         |
| config       | json        | validado contra `configSchema`        |
| created/updated | datetime |                                       |

### `channels`
| campo        | tipo        | notas                                 |
|--------------|-------------|---------------------------------------|
| id           | string      |                                       |
| name         | string      |                                       |
| type         | enum        | `email` \| `telegram`                 |
| config       | json        |                                       |

### `reports`
| campo           | tipo        | notas                                                              |
|-----------------|-------------|--------------------------------------------------------------------|
| id              | string      |                                                                    |
| name            | string      |                                                                    |
| source_id       | rel         | → sources                                                          |
| channel_ids     | rel[]       | → channels (1..N)                                                  |
| template_id     | string      | id del template en código                                          |
| params          | json        | parámetros del template/fetch (ej. proyecto, repo)                 |
| trigger         | enum        | `cron` \| `webhook` (debe coincidir con el modo de la source)      |
| cron            | string?     | obligatorio si trigger=cron, null si webhook                       |
| webhook_secret  | string?     | cifrado; obligatorio si trigger=webhook (HMAC verification)        |
| enabled         | bool        |                                                                    |

### `runs`
| campo        | tipo        | notas                                                          |
|--------------|-------------|----------------------------------------------------------------|
| id           | string      |                                                                |
| report_id    | rel         | → reports                                                      |
| status       | enum        | `success` \| `partial` \| `skipped` \| `failed`                |
| trigger_kind | enum        | `cron` \| `webhook` \| `manual`                                |
| started_at   | datetime    |                                                                |
| finished_at  | datetime    |                                                                |
| payload      | json        | data cruda del source                                          |
| rendered     | json        | { email, telegram } renderizados (null si skipped)             |
| deliveries   | json        | [{ channel_id, status, error }]                                |
| error        | string?     | si falló el fetch o el parseo del webhook                      |

---

## 8. Roadmap por hitos

### M1 — Esqueleto (1-2 días)
- Workspace pnpm con `apps/server` y `apps/admin`.
- PocketBase corriendo, colecciones creadas vía migración.
- Backend Hono con endpoints CRUD básicos para sources/channels/reports/runs.
- Admin con login y vistas de listado vacías.

### M2 — Primer flujo end-to-end pull (2-3 días)
- 1 source: `custom-api` (el más simple, modo pull).
- 1 channel: `telegram`.
- 1 template: pasa-por genérico que renderiza el JSON estándar + `mockData()` + preview.
- Scheduler cron `Europe/Madrid` + botón Run-now.
- Vista de detalle de Run, incluyendo estado `skipped`.
- Cifrado AES-GCM funcionando en sources/channels.

### M3 — Sources push y email (3-4 días)
- Source `github-actions` (modo push, webhook con HMAC) + template `gh-actions-workflow-failure`.
- Endpoint `POST /webhooks/:reportId` con verificación de firma.
- Channel `email` vía Resend.
- Source `sentry` + template `sentry-daily`.

### M4 — Mixpanel y pulido (2-3 días)
- Source `mixpanel` con editor JQL en el admin.
- Test-connection en admin para todas las integraciones.
- Canal de notificación de errores (fallback).
- README de despliegue (binario PocketBase + master key + Resend keys + URL pública para webhooks).

### Backlog (post-MVP)
- Retries con backoff.
- Filtros/transforms reutilizables (ej. "solo si hay > N issues").
- Templates en DB con sandbox (Liquid o similar).
- Webhooks como source genérica.
- Slack como channel.

---

## 9. Decisiones confirmadas

| # | Decisión                                                                                       |
|---|------------------------------------------------------------------------------------------------|
| 1 | **DB:** PocketBase                                                                             |
| 2 | **Despliegue:** local primero, luego VPS                                                       |
| 3 | **Secrets:** cifrados en DB (AES-256-GCM, master key en env)                                   |
| 4 | **Ventana de fetch:** últimas 24h fija, sin cursor                                             |
| 5 | **Skip empty:** si no hay nada que reportar, no se envía (run = `skipped`)                     |
| 6 | **Mixpanel:** queries JQL custom escritas en el admin                                          |
| 7 | **GitHub Actions:** webhook-driven (no polling de runs)                                        |
| 8 | **Email provider:** Resend                                                                     |
| 9 | **Timezone del cron:** `Europe/Madrid`                                                         |
| 10| **Admin:** custom desde día 1 (no panel built-in de PocketBase)                                |
| 11| **Idioma del admin:** inglés                                                                   |
| 12| **Preview de templates:** sí, con `mockData()` por template                                    |

---

## 10. Riesgos

- **Pérdida de master key**: si se pierde `AGENT_REPORTER_MASTER_KEY` los secrets en DB son irrecuperables. Mitigación: documentar en el README guardarla aparte (1Password, etc.) y nunca commitearla. Considerar comando CLI para rotarla en backlog.
- **Webhooks expuestos públicamente**: el endpoint `/webhooks/:reportId` es público por necesidad. Mitigación: HMAC obligatorio, rate limit por reportId, log de intentos fallidos. En local (dev) usar tunnel (ngrok/cloudflared) y rotar el secret al pasar a VPS.
- **Rate limits** de Sentry/Mixpanel si los reportes se programan muy frecuentes. Mitigación: cache de respuestas por ventana de tiempo si dos reports piden lo mismo.
- **Crecimiento de `runs`**: payloads JSON pueden inflar la DB (sobre todo runs de webhooks que reciben todo el payload de GH). Mitigación: TTL configurable (ej. borrar runs > 90 días) o truncar payload tras N días manteniendo el resumen.
- **Acoplamiento al template id**: si renombras un template en código, los reports en DB apuntando a él rompen. Mitigación: validar al arranque que todos los `template_id` existen y avisar.
- **JQL inválida en Mixpanel**: el usuario puede guardar una query rota desde el admin. Mitigación: hacer dry-run contra Mixpanel al guardar y rechazar si falla; en cualquier caso un fallo runtime queda como `failed` y notifica al fallback channel.
