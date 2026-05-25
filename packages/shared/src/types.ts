import type { Notification } from "./notification.js";

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

export type ChannelType = "email" | "telegram";

export type DeliveryStatus = "success" | "failed";

export interface ApiKeyRecord extends BaseRecord {
  name: string;
  token_hash: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface NotificationLogRecord extends BaseRecord {
  token_id: string;
  channel: ChannelType;
  status: DeliveryStatus;
  notification: Notification;
  recipient: string | null;
  error: string | null;
}
