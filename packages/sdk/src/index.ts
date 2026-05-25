export type NotificationLevel = "info" | "warn" | "error" | "success";

export interface NotificationItem {
  label: string;
  value: string | number;
  url?: string;
}

export interface NotificationSection {
  heading: string;
  items: NotificationItem[];
}

export interface NotificationMetadata {
  key: string;
  value: string | number;
}

export interface NotificationLink {
  label: string;
  url: string;
}

export interface Notification {
  title: string;
  body?: string;
  level?: NotificationLevel;
  sections?: NotificationSection[];
  metadata?: NotificationMetadata[];
  links?: NotificationLink[];
}

export type Channel = "telegram" | "email";

export interface ReporterOptions {
  token: string;
  baseUrl?: string;
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

export class Reporter {
  private baseUrl: string;
  private token: string;

  constructor(opts: ReporterOptions) {
    this.baseUrl = (opts.baseUrl ?? "https://api.reporter.localhost").replace(/\/$/, "");
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
      throw new Error(`reporter ${res.status}: ${text}`);
    }
    return res.json() as Promise<NotifyResult>;
  }
}
