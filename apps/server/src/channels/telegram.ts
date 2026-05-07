import { z } from "zod";
import type { ChannelAdapter } from "./types.js";

const telegramConfigSchema = z.object({
  bot_token: z.string().min(1),
  chat_id: z.string().min(1),
});

export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

// Telegram MarkdownV2 reserved characters that must be escaped if you want
// to send literal text. We use `MarkdownV2` parse mode so the template can
// emit *bold*, _italic_, etc., but we still need a helper to keep test
// payloads safe.
const MD_V2_ESCAPE = /([_*\[\]()~`>#+\-=|{}.!\\])/g;
function escapeMarkdownV2(text: string): string {
  return text.replace(MD_V2_ESCAPE, "\\$1");
}

async function sendMessage(
  config: TelegramConfig,
  text: string,
  parseMode?: "MarkdownV2",
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: config.chat_id,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`telegram API ${res.status}: ${detail.slice(0, 500)}`);
  }
}

export const telegramChannel: ChannelAdapter<TelegramConfig> = {
  type: "telegram",
  configSchema: telegramConfigSchema,

  async deliver(config, content) {
    if (!content.telegram) {
      throw new Error("template did not render telegram content");
    }
    await sendMessage(config, content.telegram);
  },

  async testDelivery(config) {
    try {
      const text = escapeMarkdownV2(
        "agent-reporter test message — delivery is working.",
      );
      await sendMessage(config, text, "MarkdownV2");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
