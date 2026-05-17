import type { Notification } from "@agent-reporter/shared";

export interface ReportTemplate<TData = unknown> {
  id: string;
  description: string;
  sourceType: string;
  shouldDeliver(data: TData): boolean;
  mockData(): TData;
  render(data: TData): Notification;
}
