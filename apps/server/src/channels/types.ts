import type { Notification } from "@agent-reporter/shared";

export interface ChannelAdapter {
  type: string;
  deliver(notification: Notification, overrideTo?: string): Promise<void>;
}
