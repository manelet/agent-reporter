import { env } from "../env.js";
import { renderTelegram } from "./render.js";
import type { ChannelAdapter } from "./types.js";

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
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

export const telegramChannel: ChannelAdapter = {
  type: "telegram",

  async deliver(notification, overrideTo) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new Error(
        "Telegram channel not configured (missing TELEGRAM_BOT_TOKEN)",
      );
    }
    const chatId = overrideTo ?? env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      throw new Error("No Telegram chat_id configured");
    }
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, renderTelegram(notification));
  },
};
