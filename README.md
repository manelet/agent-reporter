# agent-reporter

Reporting service: Sources (Sentry, Mixpanel, GitHub Actions, custom APIs) → Channels (email, Telegram), configurable from a custom admin UI. See [docs/PRD.md](docs/PRD.md).

## Stack

- **PocketBase** for the DB + auth (single binary, SQLite).
- **Hono** backend (Node) — `apps/server`.
- **React + Vite** custom admin SPA — `apps/admin`.
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

# 4. Start everything (PocketBase + server + admin in parallel)
pnpm dev
```

First run: open http://127.0.0.1:8090/_/ to create the PocketBase superuser. Then the admin login at http://127.0.0.1:5173 uses those credentials.

Ports used: PocketBase `8090`, server `3000`, admin (Vite) `5173`.
