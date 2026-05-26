import type { NotificationTemplate } from "@reporter/shared";
import { githubProvider } from "./github.js";
import { mixpanelProvider } from "./mixpanel.js";

export interface Provider {
  type: string;
  getEventType(
    headers: Record<string, string | undefined>,
    body?: unknown,
  ): string | null;
  verify(
    rawBody: string,
    secret: string | null,
    headers: Record<string, string | undefined>,
  ): boolean;
  defaultTemplates: Record<string, NotificationTemplate>;
}

const providers: Record<string, Provider> = {
  github: githubProvider,
  mixpanel: mixpanelProvider,
};

export function getProvider(type: string): Provider {
  const provider = providers[type];
  if (!provider) throw new Error(`unknown provider: ${type}`);
  return provider;
}
