import type { z } from "zod";

export interface RenderedContent {
  email?: { subject: string; html: string };
  telegram?: string;
}

export type ConfigSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export interface ChannelAdapter<TConfig = unknown> {
  type: string;
  configSchema: ConfigSchema<TConfig>;
  deliver(config: TConfig, content: RenderedContent): Promise<void>;
  testDelivery(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}
