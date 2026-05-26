import { z } from "zod";
import { notificationSchema } from "./notification.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const channelSchema = z.enum(["telegram", "email"]);
export const providerSchema = z.enum(["github", "mixpanel"]);

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

export const integrationCreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: providerSchema,
  channels: z.array(channelSchema).min(1),
  to: z.string().min(1).optional(),
  secret: z.string().min(1).optional(),
});
export type IntegrationCreate = z.infer<typeof integrationCreateSchema>;

export const integrationUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  channels: z.array(channelSchema).min(1).optional(),
  to: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  templates: z.record(z.string(), z.any()).optional(),
  enabled: z.boolean().optional(),
});
export type IntegrationUpdate = z.infer<typeof integrationUpdateSchema>;
