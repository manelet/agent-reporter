import { Resend } from "resend";
import { z } from "zod";
import type { ChannelAdapter } from "./types.js";

const emailConfigSchema = z.object({
  api_key: z.string().min(1),
  from_address: z.string().email(),
  to_addresses: z
    .array(z.string().email())
    .min(1, "at least one recipient")
    .max(20),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

async function send(
  config: EmailConfig,
  subject: string,
  html: string,
): Promise<void> {
  const resend = new Resend(config.api_key);
  const { error } = await resend.emails.send({
    from: config.from_address,
    to: config.to_addresses,
    subject,
    html,
  });
  if (error) {
    throw new Error(`resend ${error.name}: ${error.message}`);
  }
}

export const emailChannel: ChannelAdapter<EmailConfig> = {
  type: "email",
  configSchema: emailConfigSchema,

  async deliver(config, content) {
    if (!content.email) {
      throw new Error("template did not render email content");
    }
    await send(config, content.email.subject, content.email.html);
  },

  async testDelivery(config) {
    try {
      await send(
        config,
        "agent-reporter test",
        `<p>Test message from agent-reporter to ${config.to_addresses.join(
          ", ",
        )}.</p>`,
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
