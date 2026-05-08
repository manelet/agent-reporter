# agent-reporter

Reporting service: Sources (Sentry, Mixpanel, GitHub Actions, custom APIs) → Channels (email, Telegram), configurable from a custom admin UI. See [docs/PRD.md](docs/PRD.md).

## Stack

- **PocketBase** for the DB + auth (single binary, SQLite).
- **Hono** backend (Node) — `apps/server`.
- **React + Vite** custom admin SPA — `apps/admin`.
- **portless** for stable HTTPS `.localhost` URLs in dev.
- **pnpm** workspaces.

## Local setup

```bash
# 1. Install deps
pnpm install

# 2. Generate a master key (32 bytes hex) and add it to .env
cp .env.example .env
openssl rand -hex 32   # paste into AGENT_REPORTER_MASTER_KEY

# 3. Download PocketBase binary (one-time, see scripts/setup-pocketbase.sh)
./scripts/setup-pocketbase.sh

# 4. Start PocketBase (terminal 1)
pnpm dev:pb

# 5. Start server + admin via portless (terminal 2)
pnpm dev
```

First run: open <http://127.0.0.1:8090/_/> to create the PocketBase superuser. Then sign into the admin with those credentials.

## URLs

| Service     | URL                                         |
|-------------|---------------------------------------------|
| Admin SPA   | <https://agent-reporter.localhost>           |
| Server API  | <https://api.agent-reporter.localhost>       |
| Webhooks    | `https://api.agent-reporter.localhost/webhooks/<reportId>` |
| PocketBase  | <http://127.0.0.1:8090>                      |

The admin proxies `/api` and `/webhooks` to the server, so you can also open those paths under the admin host (`https://agent-reporter.localhost/api/...`).

For GitHub Actions webhooks to reach the server, expose the portless URL through a tunnel (cloudflared/ngrok) and paste the public URL into GitHub's webhook config.
