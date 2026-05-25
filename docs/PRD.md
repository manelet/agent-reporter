# reporter — PRD

## 1. Objetivo

Servicio de entrega de notificaciones. Permite enviar notificaciones a Telegram y Email desde cualquier proyecto, ya sea mediante una llamada HTTP o a traves del SDK.

## 2. Arquitectura

```
caller (curl / SDK)
  │
  ▼
POST /api/notify   ← Bearer token auth
  │
  ├─► Telegram (Bot API)
  └─► Email (Resend)
  │
  ▼
notification_logs  ← PocketBase (SQLite)
```

### Componentes

| Componente | Tecnologia | Responsabilidad |
|---|---|---|
| Server | Node.js + Hono | Endpoint de notificaciones, CRUD de tokens, logs |
| Admin SPA | React + Vite | UI para gestionar tokens y ver historial |
| Shared | TypeScript + Zod | Tipos y schemas compartidos |
| SDK | TypeScript | Cliente HTTP para enviar notificaciones |
| DB | PocketBase (SQLite) | Tokens, logs, auth de admin |

### Monorepo

```
apps/server        @reporter/server
apps/admin         @reporter/admin
packages/shared    @reporter/shared
packages/sdk       @reporter/sdk
```

## 3. Funcionalidades

### 3.1 Envio de notificaciones

**Endpoint:** `POST /api/notify`

**Autenticacion:** Bearer token (generado desde el admin).

**Request:**

```json
{
  "channel": "telegram",
  "notification": {
    "title": "Deploy v2.1.0",
    "body": "Desplegado correctamente en produccion",
    "level": "success",
    "links": [{ "label": "Ver deploy", "url": "https://..." }]
  },
  "to": "opcional-override-destinatario"
}
```

**Canales soportados:**
- `telegram` — envia via Telegram Bot API (MarkdownV2)
- `email` — envia via Resend (HTML)

**Campo `to` (opcional):**
- Telegram: sobreescribe el `chat_id` por defecto
- Email: sobreescribe los destinatarios (comma-separated)

**Response:**

```json
{ "id": "log_id", "status": "success" }
```

```json
{ "id": "log_id", "status": "failed", "error": "..." }
```

### 3.2 SDK

Paquete `@reporter/sdk` — wrapper HTTP tipado. Se instala desde el repo:

```bash
pnpm add github:manelet/reporter --filter packages/sdk
```

```typescript
import { Reporter } from "@reporter/sdk";

const reporter = new Reporter({ token: "ar_..." });

await reporter.notify({
  channel: "telegram",
  notification: { title: "Hola", level: "info" },
});
```

### 3.3 Admin

UI minima con dos paginas:

- **Tokens** — crear, rotar, revocar y eliminar tokens de API
- **Logs** — tabla paginada con historial de notificaciones (canal, status, titulo, destinatario, error)

**Auth:** Login con credenciales de PocketBase superuser.

### 3.4 Gestion de tokens

- Se generan desde el admin (random 32 bytes hex)
- Solo se muestra el plaintext una vez (en creacion/rotacion)
- Se almacena solo el SHA-256 hash en DB
- Soporta rotacion (nuevo token, revoca el anterior) y revocacion

## 4. Schema de Notification

```typescript
interface Notification {
  title: string;                    // obligatorio, 1-500 chars
  body?: string;                    // markdown
  level?: "info" | "warn" | "error" | "success";
  sections?: {
    heading: string;
    items: {
      label: string;
      value: string | number;
      url?: string;
    }[];
  }[];
  metadata?: {
    key: string;
    value: string | number;
  }[];
  links?: {
    label: string;
    url: string;
  }[];
}
```

Validado con Zod en `packages/shared/src/notification.ts`.

## 5. Base de datos

PocketBase con dos colecciones:

### `api_keys`

| Campo | Tipo | Notas |
|---|---|---|
| name | text | Nombre descriptivo |
| token_hash | text (unique) | SHA-256 del token |
| last_used_at | date | Actualizado en cada uso |
| revoked_at | date | Si tiene valor, el token esta inactivo |

### `notification_logs`

| Campo | Tipo | Notas |
|---|---|---|
| token_id | relation → api_keys | Token que hizo la llamada |
| channel | select (telegram, email) | Canal utilizado |
| status | select (success, failed) | Resultado de la entrega |
| notification | json | Payload de la notificacion |
| recipient | text | Destinatario (override o default) |
| error | text | Mensaje de error si fallo |
| created | autodate | Timestamp |

## 6. Configuracion de canales

Las credenciales de los canales se configuran via variables de entorno (no en DB):

| Variable | Canal | Descripcion |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram | Token del bot |
| `TELEGRAM_CHAT_ID` | Telegram | Chat ID por defecto |
| `RESEND_API_KEY` | Email | API key de Resend |
| `RESEND_FROM_ADDRESS` | Email | Direccion del remitente |
| `RESEND_TO_ADDRESSES` | Email | Destinatarios por defecto (comma-separated) |

Un canal sin variables configuradas queda deshabilitado. Al intentar enviar a un canal no configurado, el server responde con error.

## 7. Flujo de entrega

```
1. Llega POST /api/notify con Bearer token
2. Validar token: hash → buscar en api_keys → verificar no revocado
3. Parsear body con apiNotifySchema (zod)
4. Obtener adapter del canal (telegram/email)
5. Cargar config del canal desde env vars
6. Entregar notificacion via adapter
7. Guardar log en notification_logs (status, error, etc.)
8. Responder con { id, status }
```

## 8. Renderizado

Cada canal renderiza el `Notification` a su formato nativo:

- **Email:** HTML con estilos inline (sections → listas, metadata → tabla, links → botones)
- **Telegram:** MarkdownV2 (sections → listas con bullet, metadata → bloque de codigo, links → inline links)

El renderizado vive en `apps/server/src/channels/render.ts`.

## 9. Despliegue

### Dev (local)

```bash
pnpm dev  # PocketBase + server (portless) + admin (portless)
```

URLs:
- Landing: `https://reporter.localhost`
- Admin: `https://admin.reporter.localhost`
- API: `https://api.reporter.localhost`
- PocketBase: `http://127.0.0.1:8090`

### Produccion

Docker Compose con dos servicios:
- `server` — Node.js + Hono (puerto 3000)
- `admin` — Nginx sirviendo el build de Vite (puerto 80, proxy `/api` al server)

PocketBase corre integrado o como servicio separado. Los datos persisten en el volumen `pb_data`.

Desplegado en Hetzner VPS via Coolify.
