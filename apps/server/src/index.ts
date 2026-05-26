import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { requireAuth } from "./auth.js";
import { apiKeysRoutes } from "./api/api-keys.js";
import { authRoutes } from "./api/auth.js";
import { notifyRoutes } from "./api/notify.js";
import { notificationLogsRoutes } from "./api/notification-logs.js";
import { webhookRoutes } from "./api/webhook.js";
import { integrationsRoutes } from "./api/integrations.js";

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

app.route("/api/auth", authRoutes);
app.route("/api/notify", notifyRoutes);
app.route("/api/webhook", webhookRoutes);

const protectedApi = new Hono();
protectedApi.use("*", requireAuth);
protectedApi.route("/api-keys", apiKeysRoutes);
protectedApi.route("/notification-logs", notificationLogsRoutes);
protectedApi.route("/integrations", integrationsRoutes);
app.route("/api", protectedApi);

app.onError((err, c) => {
  console.error("[server error]", err);
  if ("getResponse" in err && typeof err.getResponse === "function") {
    return err.getResponse();
  }
  return c.json({ error: err.message ?? "internal error" }, 500);
});

serve(
  { fetch: app.fetch, port: env.PORT, hostname: env.SERVER_HOST },
  ({ port, address }) => {
    console.log(`[server] listening on http://${address}:${port}`);
  },
);
