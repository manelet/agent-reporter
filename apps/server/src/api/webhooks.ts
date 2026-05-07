import { Hono } from "hono";
import { decrypt, decryptConfig } from "../crypto.js";
import { getServerPb } from "../pb.js";
import { executeWebhookReport } from "../runner.js";
import {
  getSourceAdapter,
  verifyGithubSignature,
} from "../sources/index.js";
import type { PushSourceAdapter } from "../sources/types.js";

// Public, unauthenticated. Each report exposes its own URL with a
// per-report secret used for HMAC verification.
export const webhooksRoutes = new Hono().post("/:reportId", async (c) => {
  const reportId = c.req.param("reportId");
  const rawBody = await c.req.text();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.header())) {
    if (typeof v === "string") headers[k.toLowerCase()] = v;
  }

  const pb = await getServerPb();

  let report: {
    id: string;
    source: string;
    enabled: boolean;
    webhook_secret: string;
    trigger: string;
  };
  try {
    report = (await pb
      .collection("reports")
      .getOne(reportId)) as unknown as typeof report;
  } catch {
    return c.json({ error: "report not found" }, 404);
  }
  if (report.trigger !== "webhook") {
    return c.json({ error: "report is not webhook-triggered" }, 400);
  }
  if (!report.enabled) {
    return c.json({ error: "report disabled" }, 403);
  }
  if (!report.webhook_secret) {
    return c.json({ error: "report has no webhook secret" }, 500);
  }

  const sourceRow = await pb.collection("sources").getOne(report.source);
  const sourceAdapter = getSourceAdapter(sourceRow.type);
  if (sourceAdapter.mode !== "push") {
    return c.json({ error: "source is not push-mode" }, 400);
  }

  // Per-source HMAC verification. Each push source decides which header to
  // check (e.g. github-actions uses X-Hub-Signature-256). For now we
  // hardcode github's scheme; when we add more push sources, we can route
  // to a per-adapter `verifySignature` method.
  const secret = decrypt(report.webhook_secret);
  if (sourceRow.type === "github-actions") {
    const sig = headers["x-hub-signature-256"];
    if (!verifyGithubSignature(rawBody, sig, secret)) {
      return c.json({ error: "invalid signature" }, 401);
    }
  } else {
    return c.json({ error: "no signature scheme for source type" }, 500);
  }

  const config = sourceAdapter.configSchema.parse(
    decryptConfig((sourceRow.config ?? {}) as Record<string, unknown>),
  );

  let parsed: unknown;
  try {
    parsed = await (sourceAdapter as PushSourceAdapter).parseWebhook(
      config,
      headers,
      rawBody,
    );
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : "parse failed" },
      400,
    );
  }
  if (parsed === null) {
    // Event ignored (wrong type, wrong repo, in-progress run, etc.).
    return c.json({ ignored: true }, 202);
  }

  try {
    const outcome = await executeWebhookReport(reportId, parsed, pb);
    return c.json(outcome);
  } catch (e) {
    console.error("[webhook] run failed", e);
    return c.json(
      { error: e instanceof Error ? e.message : "run failed" },
      500,
    );
  }
});
