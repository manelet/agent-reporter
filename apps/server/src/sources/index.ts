import { customApiSource } from "./custom-api.js";
import { githubActionsSource } from "./github-actions.js";
import { sentrySource } from "./sentry.js";
import type { SourceAdapter } from "./types.js";

export const sourceAdapters: Record<string, SourceAdapter> = {
  [customApiSource.type]: customApiSource as SourceAdapter,
  [githubActionsSource.type]: githubActionsSource as SourceAdapter,
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
export type { CustomApiConfig, CustomApiPayload } from "./custom-api.js";
export { githubActionsSource, verifyGithubSignature } from "./github-actions.js";
export type {
  GithubActionsConfig,
  GithubActionsWorkflowRunData,
} from "./github-actions.js";
export { sentrySource } from "./sentry.js";
export type { SentryConfig, SentryDailyData, SentryIssue } from "./sentry.js";
