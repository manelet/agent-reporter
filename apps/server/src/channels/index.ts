import { emailChannel } from "./email.js";
import { telegramChannel } from "./telegram.js";
import type { ChannelAdapter } from "./types.js";

const adapters: Record<string, ChannelAdapter> = {
  email: emailChannel,
  telegram: telegramChannel,
};

export function getChannelAdapter(type: string): ChannelAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`unknown channel type: ${type}`);
  }
  return adapter;
}
