import { createHmac, timingSafeEqual } from "node:crypto";
import type { NotificationTemplate } from "@reporter/shared";
import type { Provider } from "./index.js";

export const defaultTemplates: Record<string, NotificationTemplate> = {
  push: {
    title: "Push to {{repository.name}}/{{ref}}",
    body: "{{pusher.name}} pushed to {{ref}}",
    level: "info",
    sections: [
      {
        heading: "Commits",
        items: "commits",
        label: "{{message}}",
        value: "{{author.name}}",
        url: "{{url}}",
      },
    ],
    metadata: [
      { key: "Branch", value: "{{ref}}" },
      { key: "Pusher", value: "{{pusher.name}}" },
    ],
    links: [{ label: "Compare", url: "{{compare}}" }],
  },

  pull_request: {
    title: "PR {{action}}: {{pull_request.title}}",
    body: "#{{pull_request.number}} by {{pull_request.user.login}}",
    level: "info",
    metadata: [
      { key: "State", value: "{{pull_request.state}}" },
      { key: "Additions", value: "{{pull_request.additions}}" },
      { key: "Deletions", value: "{{pull_request.deletions}}" },
      { key: "Changed files", value: "{{pull_request.changed_files}}" },
    ],
    links: [{ label: "View PR", url: "{{pull_request.html_url}}" }],
  },

  issues: {
    title: "Issue {{action}}: {{issue.title}}",
    body: "#{{issue.number}} by {{issue.user.login}}",
    level: "info",
    metadata: [
      { key: "State", value: "{{issue.state}}" },
      { key: "Labels", value: "{{issue.labels.length}}" },
    ],
    links: [{ label: "View issue", url: "{{issue.html_url}}" }],
  },

  workflow_run: {
    title: "Workflow {{action}}: {{workflow_run.name}}",
    body: "Conclusion: {{workflow_run.conclusion}}",
    level: "info",
    metadata: [
      { key: "Branch", value: "{{workflow_run.head_branch}}" },
      { key: "Event", value: "{{workflow_run.event}}" },
      { key: "Status", value: "{{workflow_run.status}}" },
    ],
    links: [{ label: "View run", url: "{{workflow_run.html_url}}" }],
  },
};

function verifySignature(
  rawBody: string,
  secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
    "utf8",
  );
  const actual = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export const githubProvider: Provider = {
  type: "github",

  getEventType(headers) {
    return headers["x-github-event"] ?? null;
  },

  verify(rawBody, secret, headers) {
    if (!secret) return true;
    return verifySignature(rawBody, secret, headers["x-hub-signature-256"]);
  },

  defaultTemplates,
};
