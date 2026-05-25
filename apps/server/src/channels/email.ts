import { Resend } from "resend";
import { env } from "../env.js";
import { renderEmail } from "./render.js";
import type { ChannelAdapter } from "./types.js";

export const emailChannel: ChannelAdapter = {
  type: "email",

  async deliver(notification, overrideTo) {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_ADDRESS) {
      throw new Error(
        "Email channel not configured (missing RESEND_API_KEY or RESEND_FROM_ADDRESS)",
      );
    }
    const to = overrideTo
      ? overrideTo.split(",").map((e) => e.trim())
      : env.RESEND_TO_ADDRESSES;
    if (!to?.length) {
      throw new Error("No email recipients configured");
    }
    const resend = new Resend(env.RESEND_API_KEY);
    const { subject, html } = renderEmail(notification);
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (error) {
      throw new Error(`resend ${error.name}: ${error.message}`);
    }
  },
};
