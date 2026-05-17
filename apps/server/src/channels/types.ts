import type { Notification } from "@agent-reporter/shared";
import type { z } from "zod";

export type ConfigSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export interface ChannelAdapter<TConfig = unknown> {
  type: string;
  configSchema: ConfigSchema<TConfig>;
  deliver(config: TConfig, notification: Notification): Promise<void>;
  testDelivery(config: TConfig): Promise<{ ok: boolean; error?: string }>;
}
