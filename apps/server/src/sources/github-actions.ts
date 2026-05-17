import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PushSourceAdapter } from "./types.js";

const githubActionsConfigSchema = z.object({
  // Restrict events to a single repo. The workflow_run payload's
  // `repository.full_name` must match.
  repo: z.string().regex(/^[^/]+\/[^/]+$/, "expected owner/name"),
  // Optional: filter to a specific workflow name.
  workflow_name: z.string().optional(),
});

export type GithubActionsConfig = z.infer<typeof githubActionsConfigSchema>;

// Subset of the GitHub workflow_run webhook we care about.
const workflowRunEventSchema = z.object({
  action: z.string(),
  workflow_run: z.object({
    id: z.number(),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    html_url: z.string().url(),
    head_branch: z.string().nullable(),
    head_sha: z.string(),
    run_number: z.number(),
    run_attempt: z.number(),
    event: z.string(),
    actor: z.object({ login: z.string() }).nullable().optional(),
    triggering_actor: z.object({ login: z.string() }).nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: z.object({
    full_name: z.string(),
    html_url: z.string().url(),
  }),
  sender: z.object({ login: z.string() }).optional(),
});

export type GithubActionsWorkflowRunData = z.infer<
  typeof workflowRunEventSchema
>;

// Verifies a `<prefix>=<hex>` signature header (GitHub: sha256= prefix).
// Constant-time comparison to avoid timing oracles.
function verifyHmacHeader(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  prefix: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(prefix)) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader.slice(prefix.length), "hex");
  } catch {
    return false;
  }
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export const githubActionsSource: PushSourceAdapter<
  GithubActionsConfig,
  GithubActionsWorkflowRunData
> = {
  type: "github-actions",
  mode: "push",
  emitsNotification: false,
  configSchema: githubActionsConfigSchema,

  verifySignature(headers, rawBody, secret) {
    return verifyHmacHeader(
      rawBody,
      headers["x-hub-signature-256"],
      secret,
      "sha256=",
    );
  },

  async parseWebhook(config, headers, rawBody) {
    // Only act on workflow_run events; ignore everything else GH might
    // be configured to send.
    const event = headers["x-github-event"];
    if (event !== "workflow_run") return null;

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("webhook body is not valid JSON");
    }
    const parsed = workflowRunEventSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `unexpected workflow_run payload: ${parsed.error.message}`,
      );
    }
    const data = parsed.data;

    // Only completed runs are interesting (action=completed). Drop the rest
    // (queued, in_progress, requested) — they would just create noise.
    if (data.action !== "completed") return null;

    if (data.repository.full_name !== config.repo) return null;
    if (
      config.workflow_name &&
      data.workflow_run.name !== config.workflow_name
    ) {
      return null;
    }

    return data;
  },
};
