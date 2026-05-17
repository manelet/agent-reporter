// DB row shapes (what the API returns to the admin).
// Inputs (create/update) live as zod schemas in schemas.ts.

import type { Notification } from "./notification.js";

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

export type SourceType =
  | "sentry"
  | "mixpanel"
  | "github-actions"
  | "custom-api"
  | "notification-webhook";

export type ChannelType = "email" | "telegram";

export type Trigger = "cron" | "webhook";

export type RunStatusValue = "success" | "partial" | "skipped" | "failed";

export type TriggerKindValue = "cron" | "webhook" | "manual" | "api";

export interface SourceRecord extends BaseRecord {
  name: string;
  type: SourceType;
  // Decrypted server-side before sending to the admin SPA.
  config: Record<string, unknown>;
}

export interface ChannelRecord extends BaseRecord {
  name: string;
  type: ChannelType;
  config: Record<string, unknown>;
}

export interface ReportRecord extends BaseRecord {
  name: string;
  source: string;
  channels: string[];
  // Nullable: only required when the source does not emit Notification directly.
  template_id: string | null;
  params: Record<string, unknown>;
  trigger: Trigger;
  cron: string | null;
  // The server reports the secret as a sentinel ("set" | "unset"). The raw
  // value is only returned when ?reveal=true is passed.
  webhook_secret_status: "set" | "unset";
  webhook_path?: string;
  webhook_secret?: string;
  enabled: boolean;
}

export interface RunRecord extends BaseRecord {
  // Nullable: runs from POST /api/notify have no parent report.
  report: string | null;
  status: RunStatusValue;
  trigger_kind: TriggerKindValue;
  started_at: string | null;
  finished_at: string | null;
  payload: unknown;
  notification: Notification | null;
  deliveries: Array<{
    channel_id: string;
    status: "ok" | "failed";
    error?: string;
  }>;
  error: string | null;
}

export interface ApiKeyRecord extends BaseRecord {
  name: string;
  // Hash only; plaintext is shown once on creation and never persisted.
  token_hash: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
