import { type Notification, notificationSchema } from "@agent-reporter/shared";
import { z } from "zod";
import type { PullSourceAdapter } from "./types.js";

const customApiConfigSchema = z.object({
  url: z.string().url(),
  bearer_token: z.string().optional(),
  timeout_ms: z.number().int().positive().default(30000),
});

export type CustomApiConfig = z.infer<typeof customApiConfigSchema>;

export const customApiSource: PullSourceAdapter<CustomApiConfig, Notification> =
  {
    type: "custom-api",
    mode: "pull",
    emitsNotification: true,
    configSchema: customApiConfigSchema,

    async fetch(config, _params, window) {
      const url = new URL(config.url);
      url.searchParams.set("from", window.from.toISOString());
      url.searchParams.set("to", window.to.toISOString());

      const headers: Record<string, string> = { accept: "application/json" };
      if (config.bearer_token) {
        headers.authorization = `Bearer ${config.bearer_token}`;
      }

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), config.timeout_ms);
      let res: Response;
      try {
        res = await fetch(url, { headers, signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`source returned ${res.status}: ${body.slice(0, 500)}`);
      }
      const json = (await res.json()) as unknown;
      return notificationSchema.parse(json);
    },

    async testConnection(config) {
      try {
        const headers: Record<string, string> = { accept: "application/json" };
        if (config.bearer_token) {
          headers.authorization = `Bearer ${config.bearer_token}`;
        }
        const res = await fetch(config.url, { method: "GET", headers });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
