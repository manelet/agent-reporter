import { createHmac, timingSafeEqual } from "node:crypto";
import { type Notification, notificationSchema } from "@agent-reporter/shared";
import { z } from "zod";
import type { PushSourceAdapter } from "./types.js";

const notificationWebhookConfigSchema = z.object({}).strict();
export type NotificationWebhookConfig = z.infer<
  typeof notificationWebhookConfigSchema
>;

// Generic push source: any external service POSTs a Notification JSON body
// signed with HMAC-SHA256 in `X-Signature-256: sha256=<hex>`.
export const notificationWebhookSource: PushSourceAdapter<
  NotificationWebhookConfig,
  Notification
> = {
  type: "notification-webhook",
  mode: "push",
  emitsNotification: true,
  configSchema: notificationWebhookConfigSchema,

  verifySignature(headers, rawBody, secret) {
    const header = headers["x-signature-256"];
    if (!header || !header.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(header.slice("sha256=".length), "hex");
    } catch {
      return false;
    }
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  },

  async parseWebhook(_config, _headers, rawBody) {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("webhook body is not valid JSON");
    }
    return notificationSchema.parse(payload);
  },
};
