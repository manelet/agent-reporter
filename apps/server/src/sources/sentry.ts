import { z } from "zod";
import type { PullSourceAdapter } from "./types.js";

const sentryConfigSchema = z.object({
  // User auth token (https://sentry.io/settings/account/api/auth-tokens/)
  // OR an org-level internal-integration token. Needs `event:read` and
  // `project:read` scopes.
  token: z.string().min(1),
  organization_slug: z.string().min(1),
  project_slug: z.string().min(1),
  // Default points at sentry.io. Self-hosted users can override.
  base_url: z.string().url().default("https://sentry.io"),
});

export type SentryConfig = z.infer<typeof sentryConfigSchema>;

const sentryIssueSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  title: z.string(),
  culprit: z.string().nullable(),
  level: z.string(),
  status: z.string(),
  permalink: z.string().url(),
  count: z.union([z.string(), z.number()]),
  userCount: z.number().optional(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  isUnhandled: z.boolean().optional(),
});

export type SentryIssue = z.infer<typeof sentryIssueSchema>;

export interface SentryDailyData {
  organization: string;
  project: string;
  window: { from: string; to: string };
  new_issues: SentryIssue[];
  regressed_issues: SentryIssue[];
}

async function fetchIssues(
  config: SentryConfig,
  query: string,
): Promise<SentryIssue[]> {
  const url = new URL(
    `/api/0/projects/${config.organization_slug}/${config.project_slug}/issues/`,
    config.base_url,
  );
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "100");

  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`sentry ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as unknown;
  return z.array(sentryIssueSchema).parse(json);
}

export const sentrySource: PullSourceAdapter<SentryConfig, SentryDailyData> = {
  type: "sentry",
  mode: "pull",
  emitsNotification: false,
  configSchema: sentryConfigSchema,

  async fetch(config, _params, window) {
    const fromIso = window.from.toISOString();
    const toIso = window.to.toISOString();
    // Sentry's search syntax accepts age:-24h OR firstSeen:>=…
    // Using firstSeen / regressed.* explicit ranges keeps it precise.
    const isNew = `is:unresolved firstSeen:>=${fromIso} firstSeen:<${toIso}`;
    const isRegressed = `is:unresolved regressed:>=${fromIso} regressed:<${toIso}`;

    const [newIssues, regressedIssues] = await Promise.all([
      fetchIssues(config, isNew),
      fetchIssues(config, isRegressed),
    ]);

    return {
      organization: config.organization_slug,
      project: config.project_slug,
      window: { from: fromIso, to: toIso },
      new_issues: newIssues,
      regressed_issues: regressedIssues,
    };
  },

  async testConnection(config) {
    try {
      const url = new URL(
        `/api/0/projects/${config.organization_slug}/${config.project_slug}/`,
        config.base_url,
      );
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${config.token}`,
          accept: "application/json",
        },
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `HTTP ${res.status} — check token, org slug, project slug`,
        };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
