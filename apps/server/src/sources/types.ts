import type { z } from "zod";

export interface TimeWindow {
  from: Date;
  to: Date;
}

// Schemas with defaults/transforms have differing input/output types, so we
// keep the input side loose (`unknown`) and pin only the parsed output.
export type ConfigSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

interface SourceAdapterBase<TConfig> {
  type: string;
  configSchema: ConfigSchema<TConfig>;
  // `true` means fetch/parseWebhook returns a Notification directly; reports
  // built on this source must not have a template. `false` means the
  // returned shape is template-specific and a template is required.
  emitsNotification: boolean;
}

export interface PullSourceAdapter<TConfig = unknown, TData = unknown>
  extends SourceAdapterBase<TConfig> {
  mode: "pull";
  fetch(
    config: TConfig,
    params: Record<string, unknown>,
    window: TimeWindow,
  ): Promise<TData>;
  testConnection(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

export interface PushSourceAdapter<TConfig = unknown, TData = unknown>
  extends SourceAdapterBase<TConfig> {
  mode: "push";
  // Verifies the per-report webhook secret against the incoming request.
  // Different push sources use different signature schemes (e.g. GitHub:
  // X-Hub-Signature-256; generic: X-Signature-256).
  verifySignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean;
  parseWebhook(
    config: TConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<TData | null>;
}

export type SourceAdapter<TConfig = unknown, TData = unknown> =
  | PullSourceAdapter<TConfig, TData>
  | PushSourceAdapter<TConfig, TData>;
