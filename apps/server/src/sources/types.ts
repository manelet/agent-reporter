import type { z } from "zod";

export interface TimeWindow {
  from: Date;
  to: Date;
}

// Schemas with defaults/transforms have differing input/output types, so we
// keep the input side loose (`unknown`) and pin only the parsed output.
export type ConfigSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export interface PullSourceAdapter<TConfig = unknown, TData = unknown> {
  type: string;
  mode: "pull";
  configSchema: ConfigSchema<TConfig>;
  fetch(
    config: TConfig,
    params: Record<string, unknown>,
    window: TimeWindow,
  ): Promise<TData>;
  testConnection(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}

export interface PushSourceAdapter<TConfig = unknown, TData = unknown> {
  type: string;
  mode: "push";
  configSchema: ConfigSchema<TConfig>;
  parseWebhook(
    config: TConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<TData | null>;
}

export type SourceAdapter<TConfig = unknown, TData = unknown> =
  | PullSourceAdapter<TConfig, TData>
  | PushSourceAdapter<TConfig, TData>;
