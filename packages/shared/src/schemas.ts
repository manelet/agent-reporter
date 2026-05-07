import { z } from "zod";

export const sourceTypeSchema = z.enum([
  "sentry",
  "mixpanel",
  "github-actions",
  "custom-api",
]);

export const channelTypeSchema = z.enum(["email", "telegram"]);

export const triggerSchema = z.enum(["cron", "webhook"]);

export const triggerKindSchema = z.enum(["cron", "webhook", "manual"]);

export const runStatusSchema = z.enum([
  "success",
  "partial",
  "skipped",
  "failed",
]);

// Source mode is implied by type. Used by adapters & validation.
export const PULL_SOURCE_TYPES = ["sentry", "mixpanel", "custom-api"] as const;
export const PUSH_SOURCE_TYPES = ["github-actions"] as const;

export type PullSourceType = (typeof PULL_SOURCE_TYPES)[number];
export type PushSourceType = (typeof PUSH_SOURCE_TYPES)[number];

export const sourceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: sourceTypeSchema,
  config: z.record(z.unknown()),
});
export type SourceCreate = z.infer<typeof sourceCreateSchema>;

export const sourceUpdateSchema = sourceCreateSchema.partial();
export type SourceUpdate = z.infer<typeof sourceUpdateSchema>;

export const channelCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: channelTypeSchema,
  config: z.record(z.unknown()),
});
export type ChannelCreate = z.infer<typeof channelCreateSchema>;

export const channelUpdateSchema = channelCreateSchema.partial();
export type ChannelUpdate = z.infer<typeof channelUpdateSchema>;

export const reportCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    source: z.string().min(1),
    channels: z.array(z.string().min(1)).min(1),
    template_id: z.string().min(1).max(100),
    params: z.record(z.unknown()).default({}),
    trigger: triggerSchema,
    cron: z.string().max(100).optional(),
    enabled: z.boolean().default(true),
  })
  .refine(
    (v) => (v.trigger === "cron" ? !!v.cron : true),
    { message: "cron is required when trigger=cron", path: ["cron"] },
  );
export type ReportCreate = z.infer<typeof reportCreateSchema>;

export const reportUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    source: z.string().min(1).optional(),
    channels: z.array(z.string().min(1)).min(1).optional(),
    template_id: z.string().min(1).max(100).optional(),
    params: z.record(z.unknown()).optional(),
    trigger: triggerSchema.optional(),
    cron: z.string().max(100).optional(),
    enabled: z.boolean().optional(),
  });
export type ReportUpdate = z.infer<typeof reportUpdateSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
