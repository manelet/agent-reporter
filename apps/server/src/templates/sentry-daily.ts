import type { SentryDailyData, SentryIssue } from "../sources/sentry.js";
import type { ReportTemplate } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function issueHtml(i: SentryIssue): string {
  return `<li>
  <a href="${escapeHtml(i.permalink)}" style="font-weight:600">${escapeHtml(i.shortId)}</a>
  <span style="color:#888">·</span> ${escapeHtml(i.title)}
  <div style="font-size:.85em;color:#666">${escapeHtml(i.level)} · ${i.count} events${
    i.userCount !== undefined ? ` · ${i.userCount} users` : ""
  }${i.culprit ? ` · ${escapeHtml(i.culprit)}` : ""}</div>
</li>`;
}

function issueText(i: SentryIssue): string {
  const culprit = i.culprit ? ` — ${i.culprit}` : "";
  return `• [${i.level}] ${i.shortId} · ${i.title}${culprit} (${i.count} events)\n  ${i.permalink}`;
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

  renderEmail(data) {
    const heading = (label: string, count: number) =>
      `<h3 style="margin:1.25rem 0 .25rem">${escapeHtml(label)} <span style="color:#888;font-weight:normal">(${count})</span></h3>`;
    const list = (issues: SentryIssue[]) =>
      issues.length
        ? `<ul style="padding-left:1.25rem;margin:0">${issues.map(issueHtml).join("")}</ul>`
        : `<p style="color:#888;margin:0">None.</p>`;

    const subject = `[Sentry ${data.organization}/${data.project}] ${data.new_issues.length} new, ${data.regressed_issues.length} regressed`;
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:1rem;color:#222">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${escapeHtml(data.organization)} / ${escapeHtml(data.project)}</h1>
<p style="color:#666;font-size:.9em;margin:0 0 1rem">Window: ${escapeHtml(data.window.from)} → ${escapeHtml(data.window.to)}</p>
${heading("New issues", data.new_issues.length)}${list(data.new_issues)}
${heading("Regressed", data.regressed_issues.length)}${list(data.regressed_issues)}
</body></html>`;
    return { subject, html };
  },

  renderTelegram(data) {
    const lines: string[] = [
      `Sentry · ${data.organization}/${data.project}`,
      `${data.new_issues.length} new, ${data.regressed_issues.length} regressed`,
    ];
    if (data.new_issues.length) {
      lines.push("", "New:");
      for (const i of data.new_issues) lines.push(issueText(i));
    }
    if (data.regressed_issues.length) {
      lines.push("", "Regressed:");
      for (const i of data.regressed_issues) lines.push(issueText(i));
    }
    return lines.join("\n");
  },
};
