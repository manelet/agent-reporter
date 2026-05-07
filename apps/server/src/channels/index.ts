import { emailChannel } from "./email.js";
import { telegramChannel } from "./telegram.js";
import type { ChannelAdapter } from "./types.js";

export const channelAdapters: Record<string, ChannelAdapter> = {
  [telegramChannel.type]: telegramChannel as ChannelAdapter,
  [emailChannel.type]: emailChannel as ChannelAdapter,
};

export function getChannelAdapter(type: string): ChannelAdapter {
  const adapter = channelAdapters[type];
  if (!adapter) {
    throw new Error(`unknown channel type: ${type}`);
  }
  return adapter;
}

export type * from "./types.js";
export { telegramChannel } from "./telegram.js";
export { emailChannel } from "./email.js";
export type { TelegramConfig } from "./telegram.js";
export type { EmailConfig } from "./email.js";
