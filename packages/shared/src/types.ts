import type { Notification } from "./notification.js";

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

export type ChannelType = "email" | "telegram";

export type DeliveryStatus = "success" | "failed";

export type ProviderType = "github" | "mixpanel";

export interface ApiKeyRecord extends BaseRecord {
  name: string;
  token_hash: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface NotificationTemplate {
  title: string;
  body?: string;
  level?: string;
  sections?: {
    heading: string;
    items: string;
    label: string;
    value: string;
    url?: string;
  }[];
  metadata?: { key: string; value: string }[];
  links?: { label: string; url: string }[];
}

export interface IntegrationRecord extends BaseRecord {
  name: string;
  provider: ProviderType;
  channels: ChannelType[];
  to: string | null;
  templates: Record<string, NotificationTemplate>;
  secret: string | null;
  enabled: boolean;
}

export interface NotificationLogRecord extends BaseRecord {
  token_id: string | null;
  integration_id: string | null;
  channel: ChannelType;
  status: DeliveryStatus;
  notification: Notification;
  recipient: string | null;
  error: string | null;
}
