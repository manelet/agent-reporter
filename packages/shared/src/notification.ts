import { z } from "zod";

// The abstract notification contract — the single shape that flows through
// the pipeline. Producers (sources, templates, /api/notify callers) emit it;
// channels render it to their native medium.

const itemSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  url: z.string().url().optional(),
});

const sectionSchema = z.object({
  heading: z.string().min(1),
  items: z.array(itemSchema).default([]),
});

const metadataEntrySchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const notificationLevelSchema = z.enum([
  "info",
  "warn",
  "error",
  "success",
]);

export const notificationSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  level: notificationLevelSchema.optional(),
  sections: z.array(sectionSchema).optional(),
  metadata: z.array(metadataEntrySchema).optional(),
  links: z.array(linkSchema).optional(),
});

export type NotificationLevel = z.infer<typeof notificationLevelSchema>;
export type NotificationSection = z.infer<typeof sectionSchema>;
export type NotificationItem = z.infer<typeof itemSchema>;
export type NotificationMetadata = z.infer<typeof metadataEntrySchema>;
export type NotificationLink = z.infer<typeof linkSchema>;
export type Notification = z.infer<typeof notificationSchema>;
