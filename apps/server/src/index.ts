import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { requireAuth } from "./auth.js";
import { authRoutes } from "./api/auth.js";
import { channelsRoutes } from "./api/channels.js";
import { reportsRoutes } from "./api/reports.js";
import { runsRoutes } from "./api/runs.js";
import { sourcesRoutes } from "./api/sources.js";
import { templatesRoutes } from "./api/templates.js";
import { webhooksRoutes } from "./api/webhooks.js";
import { initScheduler } from "./scheduler.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.ADMIN_ORIGIN,
    credentials: true,
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

// Public webhooks: no auth middleware; HMAC is verified per-source inside
// the handler using the report's own secret.
app.route("/webhooks", webhooksRoutes);

app.route("/api/auth", authRoutes);

const protectedApi = new Hono();
protectedApi.use("*", requireAuth);
protectedApi.route("/sources", sourcesRoutes);
protectedApi.route("/channels", channelsRoutes);
protectedApi.route("/reports", reportsRoutes);
protectedApi.route("/runs", runsRoutes);
protectedApi.route("/templates", templatesRoutes);
app.route("/api", protectedApi);

app.onError((err, c) => {
  console.error("[server error]", err);
  if ("getResponse" in err && typeof err.getResponse === "function") {
    return err.getResponse();
  }
  return c.json({ error: err.message ?? "internal error" }, 500);
});

serve(
  { fetch: app.fetch, port: env.SERVER_PORT, hostname: env.SERVER_HOST },
  ({ port, address }) => {
    console.log(`[server] listening on http://${address}:${port}`);
    initScheduler().catch((e) => {
      console.error("[scheduler] init failed", e);
    });
  },
);
