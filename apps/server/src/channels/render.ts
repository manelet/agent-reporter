import type { Notification } from "@agent-reporter/shared";

// Channel-side rendering. Producers never touch HTML or MarkdownV2 — they
// emit a Notification and we convert here.

const LEVEL_EMOJI: Record<NonNullable<Notification["level"]>, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  success: "✅",
};

const LEVEL_COLOR: Record<NonNullable<Notification["level"]>, string> = {
  info: "#0969da",
  warn: "#bf8700",
  error: "#cf222e",
  success: "#1a7f37",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Telegram MarkdownV2 reserved characters that must be escaped to be literal.
const MD_V2_ESCAPE = /([_*\[\]()~`>#+\-=|{}.!\\])/g;
function escapeMd(text: string): string {
  return text.replace(MD_V2_ESCAPE, "\\$1");
}

function escapeMdUrl(url: string): string {
  // Inside the `(url)` part of a link, only `)` and `\` need escaping.
  return url.replace(/([)\\])/g, "\\$1");
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderEmail(n: Notification): RenderedEmail {
  const subject = n.title;
  const accent = n.level ? LEVEL_COLOR[n.level] : "#222";
  const emoji = n.level ? `${LEVEL_EMOJI[n.level]} ` : "";

  const bodyHtml = n.body
    ? `<p style="white-space:pre-wrap;margin:0 0 1rem">${escapeHtml(n.body)}</p>`
    : "";

  const sectionsHtml = (n.sections ?? [])
    .filter((s) => s.items.length > 0)
    .map((s) => {
      const items = s.items
        .map((i) => {
          const label = i.url
            ? `<a href="${escapeHtml(i.url)}">${escapeHtml(i.label)}</a>`
            : escapeHtml(i.label);
          return `<li>${label}: <strong>${escapeHtml(String(i.value))}</strong></li>`;
        })
        .join("");
      return `<h3 style="margin:1rem 0 .25rem;font-size:1rem">${escapeHtml(s.heading)}</h3><ul style="margin:0;padding-left:1.25rem">${items}</ul>`;
    })
    .join("");

  const metadataHtml = n.metadata?.length
    ? `<table style="border-collapse:collapse;margin:1rem 0;font-size:.9em">${n.metadata
        .map(
          (m) =>
            `<tr><td style="padding:.25rem .75rem .25rem 0;color:#666">${escapeHtml(m.key)}</td><td style="padding:.25rem 0"><strong>${escapeHtml(String(m.value))}</strong></td></tr>`,
        )
        .join("")}</table>`
    : "";

  const linksHtml = n.links?.length
    ? `<p style="margin:1rem 0 0">${n.links
        .map(
          (l) =>
            `<a href="${escapeHtml(l.url)}" style="display:inline-block;margin-right:1rem;color:${accent};font-weight:600">${escapeHtml(l.label)} →</a>`,
        )
        .join("")}</p>`
    : "";

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:1rem;color:#222">
<h1 style="font-size:1.25rem;margin:0 0 .5rem;color:${accent}">${emoji}${escapeHtml(n.title)}</h1>
${bodyHtml}${sectionsHtml}${metadataHtml}${linksHtml}
</body></html>`;

  return { subject, html };
}

export function renderTelegram(n: Notification): string {
  const emoji = n.level ? `${LEVEL_EMOJI[n.level]} ` : "";
  const lines: string[] = [`${emoji}*${escapeMd(n.title)}*`];

  if (n.body) {
    lines.push("", escapeMd(n.body));
  }

  for (const s of n.sections ?? []) {
    if (!s.items.length) continue;
    lines.push("", `*${escapeMd(s.heading)}*`);
    for (const i of s.items) {
      const value = escapeMd(String(i.value));
      const labelText = `${escapeMd(i.label)}: *${value}*`;
      const line = i.url
        ? `• [${escapeMd(i.label)}](${escapeMdUrl(i.url)}): *${value}*`
        : `• ${labelText}`;
      lines.push(line);
    }
  }

  if (n.metadata?.length) {
    lines.push("", "```");
    const maxKeyLen = Math.max(...n.metadata.map((m) => m.key.length));
    for (const m of n.metadata) {
      lines.push(`${m.key.padEnd(maxKeyLen)}  ${m.value}`);
    }
    lines.push("```");
  }

  if (n.links?.length) {
    lines.push("");
    for (const l of n.links) {
      lines.push(`→ [${escapeMd(l.label)}](${escapeMdUrl(l.url)})`);
    }
  }

  return lines.join("\n");
}
