import type { Notification } from "@reporter/shared";

export interface ChannelAdapter {
  type: string;
  deliver(notification: Notification, overrideTo?: string): Promise<void>;
}
