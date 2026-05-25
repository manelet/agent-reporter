import { z } from "zod";
import { notificationSchema } from "./notification.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const channelSchema = z.enum(["telegram", "email"]);

export const apiNotifySchema = z.object({
  channel: channelSchema,
  notification: notificationSchema,
  to: z.string().min(1).optional(),
});
export type ApiNotifyInput = z.infer<typeof apiNotifySchema>;

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100).default("global"),
});
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;
