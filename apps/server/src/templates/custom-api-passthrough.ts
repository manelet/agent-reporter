import type { CustomApiPayload } from "../sources/custom-api.js";
import type { ReportTemplate } from "./types.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const customApiPassthrough: ReportTemplate<CustomApiPayload> = {
  id: "custom-api-passthrough",
  description:
    "Generic renderer for the standard custom-api JSON payload (sections + metrics).",
  sourceType: "custom-api",

  shouldDeliver(data) {
    const hasSections = data.sections.some((s) => s.items.length > 0);
    const hasMetrics = data.metrics.length > 0;
    return hasSections || hasMetrics || !!data.summary;
  },

  mockData() {
    return {
      title: "Daily build summary",
      generated_at: new Date().toISOString(),
      summary: "3 deploys completed, 1 failed.",
      sections: [
        {
          heading: "Deploys",
          items: [
            {
              label: "api v1.2.3",
              value: "ok",
              url: "https://example.com/build/123",
            },
            {
              label: "web v0.9.5",
              value: "failed",
              url: "https://example.com/build/124",
            },
          ],
        },
      ],
      metrics: [
        { label: "Errors p95", value: 12, delta: "+3" },
        { label: "Builds", value: 4, delta: "0" },
      ],
    };
  },

  renderEmail(data) {
    const sections = data.sections
      .filter((s) => s.items.length > 0)
      .map((s) => {
        const items = s.items
          .map((i) => {
            const label = i.url
              ? `<a href="${escapeHtml(i.url)}">${escapeHtml(i.label)}</a>`
              : escapeHtml(i.label);
            return `<li>${label}: ${escapeHtml(String(i.value))}</li>`;
          })
          .join("");
        return `<h3>${escapeHtml(s.heading)}</h3><ul>${items}</ul>`;
      })
      .join("");

    const metrics = data.metrics.length
      ? `<h3>Metrics</h3><ul>${data.metrics
          .map((m) => {
            const delta = m.delta
              ? ` <span style="color:#888">(${escapeHtml(m.delta)})</span>`
              : "";
            return `<li>${escapeHtml(m.label)}: <strong>${escapeHtml(
              String(m.value),
            )}</strong>${delta}</li>`;
          })
          .join("")}</ul>`
      : "";

    const summary = data.summary
      ? `<p>${escapeHtml(data.summary)}</p>`
      : "";

    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:1rem;color:#222">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${escapeHtml(data.title)}</h1>
${summary}${sections}${metrics}
</body></html>`;

    return { subject: data.title, html };
  },

  renderTelegram(data) {
    const lines: string[] = [data.title];
    if (data.summary) lines.push("", data.summary);

    for (const s of data.sections) {
      if (!s.items.length) continue;
      lines.push("", `${s.heading}:`);
      for (const i of s.items) {
        const link = i.url ? ` (${i.url})` : "";
        lines.push(`• ${i.label}: ${i.value}${link}`);
      }
    }

    if (data.metrics.length) {
      lines.push("", "Metrics:");
      for (const m of data.metrics) {
        const delta = m.delta ? ` ${m.delta}` : "";
        lines.push(`• ${m.label}: ${m.value}${delta}`);
      }
    }

    return lines.join("\n");
  },
};
