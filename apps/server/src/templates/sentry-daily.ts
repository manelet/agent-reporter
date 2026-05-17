import type { Notification } from "@agent-reporter/shared";
import type { SentryDailyData, SentryIssue } from "../sources/sentry.js";
import type { ReportTemplate } from "./types.js";

function issueItem(i: SentryIssue) {
  const events =
    typeof i.count === "string" ? i.count : `${i.count} events`;
  const users = i.userCount !== undefined ? ` · ${i.userCount} users` : "";
  return {
    label: `${i.shortId} · ${i.title}`,
    value: `${i.level} · ${events}${users}`,
    url: i.permalink,
  };
}

export const sentryDaily: ReportTemplate<SentryDailyData> = {
  id: "sentry-daily",
  description:
    "Daily Sentry digest: new issues + regressed issues over the last 24h.",
  sourceType: "sentry",

  shouldDeliver(data) {
    return data.new_issues.length > 0 || data.regressed_issues.length > 0;
  },

  mockData() {
    return {
      organization: "acme",
      project: "web",
      window: {
        from: "2026-05-06T00:00:00Z",
        to: "2026-05-07T00:00:00Z",
      },
      new_issues: [
        {
          id: "1",
          shortId: "WEB-100",
          title: "TypeError: Cannot read property 'foo' of undefined",
          culprit: "src/components/Header.tsx in handleClick",
          level: "error",
          status: "unresolved",
          permalink: "https://sentry.io/acme/web/issues/1/",
          count: 23,
          userCount: 11,
          firstSeen: "2026-05-06T08:12:00Z",
          lastSeen: "2026-05-07T05:40:00Z",
          isUnhandled: true,
        },
      ],
      regressed_issues: [
        {
          id: "2",
          shortId: "WEB-42",
          title: "ChunkLoadError: Loading chunk 5 failed",
          culprit: "vendor.js",
          level: "warning",
          status: "unresolved",
          permalink: "https://sentry.io/acme/web/issues/42/",
          count: 7,
          userCount: 5,
          firstSeen: "2026-04-12T00:00:00Z",
          lastSeen: "2026-05-07T03:00:00Z",
        },
      ],
    };
  },

  render(data): Notification {
    const total = data.new_issues.length + data.regressed_issues.length;
    return {
      title: `Sentry ${data.organization}/${data.project}: ${data.new_issues.length} new, ${data.regressed_issues.length} regressed`,
      level: total > 0 ? "error" : "info",
      sections: [
        {
          heading: `New issues (${data.new_issues.length})`,
          items: data.new_issues.map(issueItem),
        },
        {
          heading: `Regressed (${data.regressed_issues.length})`,
          items: data.regressed_issues.map(issueItem),
        },
      ],
      metadata: [
        { key: "Window from", value: data.window.from },
        { key: "Window to", value: data.window.to },
      ],
    };
  },
};
