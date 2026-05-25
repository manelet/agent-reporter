# reporter

Notification delivery service. Send notifications to Telegram and Email via a single authenticated endpoint or the SDK.

## Stack

- **PocketBase** — DB + auth (SQLite).
- **Hono** — HTTP server (`apps/server`).
- **React + Vite** — admin SPA for token management (`apps/admin`).
- **portless** — stable HTTPS `.localhost` URLs in dev.
- **pnpm** workspaces.

## Local setup

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, and channel credentials

# 3. Download PocketBase binary (one-time)
./scripts/setup-pocketbase.sh

# 4. Start everything (PocketBase + server + admin via portless)
pnpm dev
```

First run: open <http://127.0.0.1:8090/_/> to create the PocketBase superuser. Then add those credentials to `.env`.

## URLs (dev)

| Service    | URL                                         |
|------------|---------------------------------------------|
| Landing    | <https://reporter.localhost>                 |
| Admin SPA  | <https://admin.reporter.localhost>           |
| Server API | <https://api.reporter.localhost>             |
| PocketBase | <http://127.0.0.1:8090>                      |

The admin proxies `/api` to the server, so `https://admin.reporter.localhost/api/...` works too.

## Usage

### 1. Create a token

Sign into the admin at <https://admin.reporter.localhost> and create a token on the **Tokens** page.

### 2. Send a notification

**Via curl:**

```bash
curl -X POST https://api.reporter.localhost/api/notify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "notification": {
      "title": "Deploy complete",
      "body": "v2.1.0 is live",
      "level": "success"
    }
  }'
```

**Via SDK:**

```bash
pnpm add github:manelet/reporter --filter packages/sdk
```

```typescript
import { Reporter } from "@reporter/sdk";

const reporter = new Reporter({ token: "<token>" });

await reporter.notify({
  channel: "telegram",
  notification: {
    title: "Deploy complete",
    body: "v2.1.0 is live",
    level: "success",
  },
});
```

## API

### `POST /api/notify`

Send a notification to a channel.

- **Auth:** `Authorization: Bearer <token>`
- **Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `channel` | `"telegram"` \| `"email"` | yes | Delivery channel |
| `notification` | `Notification` | yes | See schema below |
| `to` | `string` | no | Override default recipient (chat_id for Telegram, comma-separated emails for Email) |

- **Response:** `{ id, status: "success" | "failed", error? }`

### Notification schema

```typescript
{
  title: string;          // required, 1-500 chars
  body?: string;          // markdown
  level?: "info" | "warn" | "error" | "success";
  sections?: {
    heading: string;
    items: { label: string; value: string | number; url?: string }[];
  }[];
  metadata?: { key: string; value: string | number }[];
  links?: { label: string; url: string }[];
}
```

### `GET /api/notification-logs`

List notification delivery history (admin auth required).

- **Auth:** `Authorization: Bearer <pb_admin_token>`
- **Query:** `page` (default 1), `perPage` (default 50)
- **Response:** `{ items, page, perPage, totalItems }`

### `POST /api/auth/login`

Admin login.

- **Body:** `{ email, password }`
- **Response:** `{ token, user }`

### API keys (`/api/api-keys`)

Admin-only CRUD for bearer tokens.

- `GET /` — list all keys
- `POST /` — create (returns plaintext once)
- `POST /:id/rotate` — rotate token
- `POST /:id/revoke` — revoke
- `DELETE /:id` — delete

## Channel configuration

Channels are configured via environment variables. Leave empty to disable a channel.

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Default chat ID |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_ADDRESS` | Sender email address |
| `RESEND_TO_ADDRESSES` | Default recipients (comma-separated) |

## Project structure

```
apps/
  server/          Hono HTTP server (notify endpoint, token CRUD, logs)
  admin/           React + Vite SPA (token management, delivery logs)
  landing/         Static landing page
packages/
  shared/          Notification types, zod schemas
  sdk/             SDK client (@reporter/sdk)
pb_migrations/     PocketBase schema (api_keys, notification_logs)
```

## Docker

```bash
docker compose up --build
```

Requires env vars in `.env` (see `.env.example`). PocketBase data persists via the `pb_data` volume.
