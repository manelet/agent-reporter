# PRD — agent-reporter

**Estado:** Borrador v0.3
**Owner:** manelet
**Fecha:** 2026-05-14

---

## 1. Resumen

`agent-reporter` es un servicio que entrega **notificaciones** a distintos **canales** (email, Telegram). Las notificaciones pueden originarse de tres formas: (a) un **cron** que consulta una **fuente** pull (Sentry, Mixpanel, custom-api), (b) un **webhook** entrante (GitHub Actions, notification-webhook genérico), o (c) una **llamada HTTP directa** a `POST /api/notify` desde cualquier script/servicio del usuario. La configuración (qué reportar, cuándo, a dónde) se gestiona desde un **panel de admin** propio respaldado por una base de datos local (PocketBase).

El núcleo es el contrato `Notification` (§4.1): cualquier productor lo emite, cualquier canal lo entiende. Los **templates** son convertidores opcionales de "datos crudos de una fuente" → `Notification`, solo necesarios cuando la fuente no produce un `Notification` directamente.

El objetivo es tener un único lugar donde definir "todos los lunes a las 9am, mándame por Telegram las issues nuevas de Sentry del último día" y, a la vez, poder hacer `curl POST /api/notify` desde cualquier script propio sin tener que dar de alta nada.

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

El núcleo del sistema es un **pipeline de notificaciones** con un contrato abstracto. Tres entradas, un pipeline, N canales.

### 4.1 Contrato `Notification`

Estructura neutra (no atada a ningún canal) que cualquier productor emite y cualquier canal entiende:

```ts
interface Notification {
  title: string;
  body?: string;                                        // markdown
  level?: "info" | "warn" | "error" | "success";
  sections?: {
    heading: string;
    items: { label: string; value: string|number; url?: string }[];
  }[];
  metadata?: { key: string; value: string|number }[];   // se renderiza como tabla markdown
  links?: { label: string; url: string }[];             // CTAs
}
```

Cada `ChannelAdapter` decide cómo convertir `Notification` a su medio (email → HTML; telegram → MarkdownV2). El productor nunca toca HTML ni MarkdownV2.

### 4.2 Entidades

- **Source (Fuente):** una integración que obtiene datos de un sistema externo. Puede ser **pull** (fetch on demand: Sentry, Mixpanel, custom-api) o **push** (recibe webhooks: GitHub Actions, notification-webhook). Una source declara si emite `Notification` directamente (`emitsNotification: true`, p.ej. `custom-api`, `notification-webhook`) o si emite un shape propio que requiere template.
- **Channel (Canal):** una integración que entrega un `Notification`. Tiene credenciales y un tipo (`email`, `telegram`).
- **Template (opcional):** convertidor `(source data) → Notification`. Solo necesario cuando la source no emite `Notification` directamente (p.ej. el JSON de Sentry o el payload de `workflow_run` de GitHub). Si la source ya emite `Notification`, no hay template.
- **Report (Reporte):** une una `Source` con uno o más `Channel`. Define params, opcionalmente un `template_id`, y un trigger (cron para pull, webhook para push).
- **API key:** token bearer (una sola global por ahora) que autoriza `POST /api/notify`. No requiere Source ni Report.
- **Run (Ejecución):** ejecución concreta. Guarda timestamp, status, payload crudo, `Notification` final, errores y entregas por canal. Puede tener `report_id` (cron/webhook/manual) o ser anónimo (entrada vía API).

### 4.3 Flujo

```
                                              ┌─────────────────────┐
  cron + Source pull   ─► (Template?) ──────► │                     │
                                              │                     │ ──► Channel ──┐
  webhook + Source push ─► (Template?) ─────► │    Notification     │ ──► Channel ──┼─► Run
                                              │                     │ ──► Channel ──┘
  POST /api/notify (API key) ───────────────► │                     │
                                              └─────────────────────┘
```

### 4.4 Sources del MVP

| Tipo                  | Modo  | Emite Notification | Qué obtiene                                                              | Auth                      |
|-----------------------|-------|--------------------|--------------------------------------------------------------------------|---------------------------|
| `sentry`              | pull  | no (necesita tpl)  | Issues nuevas/regressions en un proyecto en las últimas 24h              | Auth token + org/project  |
| `mixpanel`            | pull  | no (necesita tpl)  | Resultado de una **query JQL custom** definida en el admin               | Service account + project |
| `github-actions`      | push  | no (necesita tpl)  | Eventos `workflow_run` recibidos por webhook desde GitHub                | Webhook secret (HMAC)     |
| `custom-api`          | pull  | sí                 | HTTP GET a un endpoint propio que devuelve `Notification` JSON (ver §5.1)| Bearer token configurable |
| `notification-webhook`| push  | sí                 | HTTP POST genérico con `Notification` JSON en el body                    | Webhook secret (HMAC)     |

### 4.5 Channels del MVP

| Tipo       | Cómo entrega                              | Auth                      |
|------------|-------------------------------------------|---------------------------|
| `email`    | Resend API                                | API key                   |
| `telegram` | Bot API → chat id                         | Bot token + chat id       |

---

## 5. Requisitos funcionales

### 5.1 Formato de respuesta de `custom-api` y `notification-webhook`

Ambas sources esperan que el productor (la API del usuario en `custom-api`, el servicio que postea en `notification-webhook`) emita directamente un `Notification` (§4.1):

```json
{
  "title": "Daily build summary",
  "body": "3 deploys completed, 1 failed.",
  "level": "warn",
  "sections": [
    {
      "heading": "Deploys",
      "items": [
        { "label": "api v1.2.3", "value": "ok", "url": "https://example.com/build/123" }
      ]
    }
  ],
  "metadata": [
    { "key": "Errors p95", "value": "12 (+3)" },
    { "key": "Builds", "value": 4 }
  ],
  "links": [
    { "label": "View dashboard", "url": "https://example.com/dashboard" }
  ]
}
```

No hay renderer intermedio: la source emite `Notification` y los canales lo formatean. Esto elimina la necesidad de templates passthrough.

### 5.2 Triggers

Hay **tres formas** de disparar una entrega:

1. **Cron** (sources pull): `sentry`, `mixpanel`, `custom-api`. Campo `cron` obligatorio (ej. `0 9 * * *`). Timezone fijo `Europe/Madrid`. El scheduler corre dentro del proceso Node con `node-cron` (sin worker separado).
2. **Webhook** (sources push): `github-actions`, `notification-webhook`. Cada `Report` expone una URL única `POST /webhooks/:reportId` con secret HMAC para verificar origen.
3. **HTTP directo**: `POST /api/notify` con `Authorization: Bearer <api_key>`. No requiere Source ni Report. El caller especifica `channels` y un `Notification`. Pensado para mandar notificaciones ad-hoc desde scripts/servicios propios sin configuración previa.

En los modos 1 y 2 hay botón **"Run now"** en el admin (con datos mock cuando es webhook, ver §5.7).

`trigger_kind` en `runs`: `cron` | `webhook` | `manual` | `api`.

### 5.3 Ventana fija de 24h
Para sources pull, el fetch siempre cubre **las últimas 24h** desde el momento de ejecución. No guardamos cursor entre runs. Razón: simplicidad — si un run falla y no se recupera, el siguiente cubrirá los últimos 24h igualmente, y los reports diarios no tienen huecos. La única consecuencia: si dos runs se ejecutan en menos de 24h pueden solapar items, pero como son notificaciones humanas (no datos transaccionales) es aceptable.

### 5.4 Skip empty reports
Si tras el fetch + filtrado no hay nada que reportar, el run **NO se entrega a los canales**. El run igualmente se guarda con `status = skipped` y queda visible en el historial. Cada template implementa `shouldDeliver(data): boolean` para decidir.

### 5.5 Templates (opcionales)

Los templates son **convertidores `(source data) → Notification`**. Solo se usan cuando una source emite datos crudos que necesitan formateo estructurado (ej. respuesta JSON de Sentry, payload `workflow_run` de GitHub). Si la source ya emite `Notification` (`custom-api`, `notification-webhook`) o la entrada es vía `POST /api/notify`, no hay template.

- Cada `Report` referencia opcionalmente un template; `template_id` es nullable.
- Validación: si la source tiene `emitsNotification === false`, el `Report` requiere `template_id`. Si `true`, el `template_id` debe estar vacío.
- Los templates viven en código (`src/templates/*.ts`), no en DB. Razón: testeables, versionados con git, sin sandbox.
- Cada template exporta `shouldDeliver(data)`, `render(data): Notification`, y `mockData()` para previsualización.
- Los canales son los responsables de convertir `Notification` a su medio nativo (HTML para email, MarkdownV2 para telegram). Los templates **no** producen HTML ni markdown de canal.

### 5.6 Panel de admin
SPA custom desde día 1. Idioma: **inglés**. Vistas:
- **Sources**: lista, crear, editar, test connection. Para `mixpanel`, editor de JQL en el form (textarea con resaltado básico, validación al guardar).
- **Channels**: lista, crear, editar, enviar mensaje de prueba.
- **Reports**: lista, crear (elegir source → según el modo el form muestra `cron` o auto-genera URL+secret de webhook → elegir channels → **template opcional** según `emitsNotification` de la source → params), editar, run-now, ver últimos runs.
- **Runs**: historial cronológico, filtrable por reporte; detalle muestra payload bruto, `Notification` final, status por canal, error. Estado `skipped` claramente diferenciado de `success`/`failed`. Los runs originados por `POST /api/notify` aparecen sin reporte asociado, con `trigger_kind: api`.
- **Template preview**: ruta dedicada (`/templates/:id/preview`) que muestra el render del `Notification` por canal usando `mockData()`. Útil para iterar sin disparar runs reales.
- **API keys**: vista para crear/rotar/revocar la API key global. Se muestra el plaintext una sola vez al crear; en DB se guarda hasheada.

Auth del admin: una sola contraseña (la de PocketBase). No hay multi-user.
Auth de `POST /api/notify`: bearer token (la API key, distinta de la auth del admin).

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
// Contrato central. Vive en packages/shared.
interface Notification {
  title: string;
  body?: string;
  level?: "info" | "warn" | "error" | "success";
  sections?: { heading: string; items: { label: string; value: string|number; url?: string }[] }[];
  metadata?: { key: string; value: string|number }[];
  links?: { label: string; url: string }[];
}

// Source pull: Sentry, Mixpanel, custom-api.
// TData puede ser Notification (la source emite el contrato directo) o
// cualquier otro shape que un template convertirá luego.
interface PullSourceAdapter<TConfig, TData> {
  type: string;
  mode: "pull";
  emitsNotification: boolean;        // true → no requiere template
  configSchema: ZodSchema<TConfig>;
  fetch(config: TConfig, params: ReportParams, window: TimeWindow): Promise<TData>;
  testConnection(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

// Source push: GitHub Actions, notification-webhook.
interface PushSourceAdapter<TConfig, TData> {
  type: string;
  mode: "push";
  emitsNotification: boolean;
  configSchema: ZodSchema<TConfig>;
  parseWebhook(
    config: TConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<TData | null>;
}

// Channels reciben Notification directamente. No hay RenderedContent.
interface ChannelAdapter<TConfig> {
  type: string;
  configSchema: ZodSchema<TConfig>;
  deliver(config: TConfig, notification: Notification): Promise<void>;
  testDelivery(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

// Templates: convertidores (TData → Notification). Opcionales.
interface ReportTemplate<TData> {
  id: string;
  sourceType: string;                       // qué source espera
  shouldDeliver(data: TData): boolean;      // false → run queda como `skipped`
  mockData(): TData;                        // para preview en admin
  render(data: TData): Notification;        // único método de render
}
```

Reglas:
- Source con `emitsNotification = true` ⇒ `Report.template_id` debe estar vacío.
- Source con `emitsNotification = false` ⇒ `Report.template_id` obligatorio y su `sourceType` debe coincidir.
- `POST /api/notify` no pasa por sources/templates: el caller manda el `Notification` ya formado y este se valida con el zod schema de `Notification`.

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
| template_id     | string?     | nullable; obligatorio solo si la source no emite Notification      |
| params          | json        | parámetros del template/fetch (ej. proyecto, repo)                 |
| trigger         | enum        | `cron` \| `webhook` (debe coincidir con el modo de la source)      |
| cron            | string?     | obligatorio si trigger=cron, null si webhook                       |
| webhook_secret  | string?     | cifrado; obligatorio si trigger=webhook (HMAC verification)        |
| enabled         | bool        |                                                                    |

### `runs`
| campo        | tipo        | notas                                                          |
|--------------|-------------|----------------------------------------------------------------|
| id           | string      |                                                                |
| report_id    | rel?        | → reports; null si la run vino de `POST /api/notify`           |
| status       | enum        | `success` \| `partial` \| `skipped` \| `failed`                |
| trigger_kind | enum        | `cron` \| `webhook` \| `manual` \| `api`                       |
| started_at   | datetime    |                                                                |
| finished_at  | datetime    |                                                                |
| payload      | json?       | data cruda del source (null si `trigger_kind=api`)             |
| notification | json?       | `Notification` final entregado (null si skipped)               |
| deliveries   | json        | [{ channel_id, status, error }]                                |
| error        | string?     | si falló el fetch o el parseo del webhook                      |

### `api_keys`
| campo        | tipo        | notas                                                          |
|--------------|-------------|----------------------------------------------------------------|
| id           | string      |                                                                |
| name         | string      | descriptivo (ej. `global`)                                     |
| token_hash   | string      | sha256 del plaintext; el plaintext no se persiste              |
| last_used_at | datetime?   | actualizado en cada uso correcto                               |
| revoked_at   | datetime?   | si está revocada, los requests con esa key dan 401             |
| created      | datetime    |                                                                |

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

### M4 — Refactor a `Notification` y API directa (3-5 días)
- Definir `Notification` + zod schema en `packages/shared`. Borrar `RenderedContent`.
- Refactor channels: `deliver(config, notification)`. Mover renderizado HTML/MarkdownV2 desde templates a channels.
- Refactor templates: nueva firma `render(data): Notification`. Reescribir los 3 existentes (`sentry-daily`, `gh-actions-workflow-failure`, `custom-api-passthrough`).
- `reports.template_id` → nullable. Validación: si `source.emitsNotification === false` requiere template; si `true`, prohibido.
- `custom-api` deja de necesitar `custom-api-passthrough`: su `fetch` devuelve `Notification` directamente. Se elimina el template.
- Nueva source push `notification-webhook`: HMAC + parseo a `Notification`.
- Nueva colección `api_keys` (1 key global, sha256 hash). Middleware bearer. Endpoint `POST /api/notify` (channels + notification → run con `report_id` null, `trigger_kind: api`).
- Admin: vista API keys (crear/rotar/revocar, plaintext una sola vez), form Report con template opcional condicional al source, form Source con `notification-webhook`.
- Migración PB: `reports.template_id` nullable, `runs.rendered` → `runs.notification`, `runs.report_id` nullable, ampliar enum `trigger_kind`, nueva tabla `api_keys`.

### M5 — Mixpanel y pulido (2-3 días)
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
| 13| **Contrato `Notification`:** estructura abstracta (title/body/level/sections/metadata/links) en `packages/shared` |
| 14| **Templates opcionales:** solo necesarios si la source no emite `Notification` directamente    |
| 15| **Entrada directa:** `POST /api/notify` con bearer token; 1 sola API key global, hash sha256 en DB |
| 16| **`RenderedContent` eliminado:** los channels reciben `Notification` directamente y se ocupan del rendering |

---

## 10. Riesgos

- **Pérdida de master key**: si se pierde `AGENT_REPORTER_MASTER_KEY` los secrets en DB son irrecuperables. Mitigación: documentar en el README guardarla aparte (1Password, etc.) y nunca commitearla. Considerar comando CLI para rotarla en backlog.
- **Webhooks expuestos públicamente**: el endpoint `/webhooks/:reportId` es público por necesidad. Mitigación: HMAC obligatorio, rate limit por reportId, log de intentos fallidos. En local (dev) usar tunnel (ngrok/cloudflared) y rotar el secret al pasar a VPS.
- **Rate limits** de Sentry/Mixpanel si los reportes se programan muy frecuentes. Mitigación: cache de respuestas por ventana de tiempo si dos reports piden lo mismo.
- **Crecimiento de `runs`**: payloads JSON pueden inflar la DB (sobre todo runs de webhooks que reciben todo el payload de GH). Mitigación: TTL configurable (ej. borrar runs > 90 días) o truncar payload tras N días manteniendo el resumen.
- **Acoplamiento al template id**: si renombras un template en código, los reports en DB apuntando a él rompen. Mitigación: validar al arranque que todos los `template_id` existen y avisar.
- **JQL inválida en Mixpanel**: el usuario puede guardar una query rota desde el admin. Mitigación: hacer dry-run contra Mixpanel al guardar y rechazar si falla; en cualquier caso un fallo runtime queda como `failed` y notifica al fallback channel.
- **Migración rompiendo compat**: el refactor a `Notification` cambia `reports.template_id` (nullable), renombra `runs.rendered` → `runs.notification`, hace `runs.report_id` nullable, amplía `trigger_kind` y elimina el template `custom-api-passthrough`. Mitigación: como es uso personal, asumir corte limpio en la migración M4; preservar `runs` históricos en `payload` cuando el rename no sea reversible.
- **API key como secret único**: si se filtra, cualquiera puede mandar notificaciones a tus canales (y consumir tu Resend / spamearte por Telegram). Mitigación: hash sha256 en DB, rotación trivial desde el admin, logging de IP/User-Agent en `last_used_at`. Backlog: scope por origen y rate-limit por key.
