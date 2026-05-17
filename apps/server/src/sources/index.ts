import { customApiSource } from "./custom-api.js";
import { githubActionsSource } from "./github-actions.js";
import { notificationWebhookSource } from "./notification-webhook.js";
import { sentrySource } from "./sentry.js";
import type { SourceAdapter } from "./types.js";

export const sourceAdapters: Record<string, SourceAdapter> = {
  [customApiSource.type]: customApiSource as SourceAdapter,
  [githubActionsSource.type]: githubActionsSource as SourceAdapter,
  [notificationWebhookSource.type]: notificationWebhookSource as SourceAdapter,
  [sentrySource.type]: sentrySource as SourceAdapter,
};

export function getSourceAdapter(type: string): SourceAdapter {
  const adapter = sourceAdapters[type];
  if (!adapter) {
    throw new Error(`unknown source type: ${type}`);
  }
  return adapter;
}

export type * from "./types.js";
export { customApiSource } from "./custom-api.js";
export type { CustomApiConfig } from "./custom-api.js";
export { githubActionsSource } from "./github-actions.js";
export type {
  GithubActionsConfig,
  GithubActionsWorkflowRunData,
} from "./github-actions.js";
export { notificationWebhookSource } from "./notification-webhook.js";
export type { NotificationWebhookConfig } from "./notification-webhook.js";
export { sentrySource } from "./sentry.js";
export type { SentryConfig, SentryDailyData, SentryIssue } from "./sentry.js";
