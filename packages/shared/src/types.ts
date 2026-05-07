// DB row shapes (what the API returns to the admin).
// Inputs (create/update) live as zod schemas in schemas.ts.

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

export type SourceType =
  | "sentry"
  | "mixpanel"
  | "github-actions"
  | "custom-api";

export type ChannelType = "email" | "telegram";

export type Trigger = "cron" | "webhook";

export type RunStatusValue = "success" | "partial" | "skipped" | "failed";

export type TriggerKindValue = "cron" | "webhook" | "manual";

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
  template_id: string;
  params: Record<string, unknown>;
  trigger: Trigger;
  cron: string | null;
  // The server reports the secret as a sentinel ("set" | "unset"), never the value.
  webhook_secret_status: "set" | "unset";
  enabled: boolean;
}

export interface RunRecord extends BaseRecord {
  report: string;
  status: RunStatusValue;
  trigger_kind: TriggerKindValue;
  started_at: string | null;
  finished_at: string | null;
  payload: unknown;
  rendered:
    | { email?: { subject: string; html: string }; telegram?: string }
    | null;
  deliveries: Array<{
    channel_id: string;
    status: "ok" | "failed";
    error?: string;
  }>;
  error: string | null;
}
