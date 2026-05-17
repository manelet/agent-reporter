import { z } from "zod";
import { renderTelegram } from "./render.js";
import type { ChannelAdapter } from "./types.js";

const telegramConfigSchema = z.object({
  bot_token: z.string().min(1),
  chat_id: z.string().min(1),
});

export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

async function sendMessage(
  config: TelegramConfig,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chat_id,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`telegram API ${res.status}: ${detail.slice(0, 500)}`);
  }
}

export const telegramChannel: ChannelAdapter<TelegramConfig> = {
  type: "telegram",
  configSchema: telegramConfigSchema,

  async deliver(config, notification) {
    await sendMessage(config, renderTelegram(notification));
  },

  async testDelivery(config) {
    try {
      await sendMessage(config, renderTelegram({
        title: "agent-reporter test",
        body: "Delivery is working.",
        level: "success",
      }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
