import type { Notification } from "@agent-reporter/shared";

export type { Notification } from "@agent-reporter/shared";
export type {
  NotificationLevel,
  NotificationSection,
  NotificationItem,
  NotificationMetadata,
  NotificationLink,
} from "@agent-reporter/shared";

export type Channel = "telegram" | "email";

export interface AgentReporterOptions {
  baseUrl: string;
  token: string;
}

export interface NotifyParams {
  channel: Channel;
  notification: Notification;
  to?: string;
}

export interface NotifyResult {
  id: string;
  status: "success" | "failed";
  error?: string;
}

export class AgentReporter {
  private baseUrl: string;
  private token: string;

  constructor(opts: AgentReporterOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
  }

  async notify(params: NotifyParams): Promise<NotifyResult> {
    const res = await fetch(`${this.baseUrl}/api/notify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`agent-reporter ${res.status}: ${text}`);
    }
    return res.json() as Promise<NotifyResult>;
  }
}
