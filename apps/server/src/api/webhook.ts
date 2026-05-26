import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getServerPb } from "../pb.js";
import { getChannelAdapter } from "../channels/index.js";
import { getProvider } from "../integrations/providers/index.js";
import { applyTemplate } from "../integrations/template.js";
import type { IntegrationRecord } from "@reporter/shared";

export const webhookRoutes = new Hono().post("/:integrationId", async (c) => {
  const { integrationId } = c.req.param();
  const pb = await getServerPb();

  let integration: IntegrationRecord;
  try {
    integration = await pb
      .collection("integrations")
      .getOne(integrationId) as unknown as IntegrationRecord;
  } catch {
    throw new HTTPException(404, { message: "integration not found" });
  }

  if (!integration.enabled) {
    throw new HTTPException(404, { message: "integration disabled" });
  }

  const provider = getProvider(integration.provider);

  const rawBody = await c.req.text();
  const headers: Record<string, string | undefined> = {};
  c.req.raw.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  if (!provider.verify(rawBody, integration.secret, headers)) {
    throw new HTTPException(401, { message: "invalid signature" });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: "invalid json body" });
  }

  const eventType = provider.getEventType(headers, body);
  if (!eventType) {
    throw new HTTPException(400, { message: "unable to determine event type" });
  }

  const template =
    integration.templates[eventType] ??
    provider.defaultTemplates[eventType];

  if (!template) {
    return c.json({ status: "skipped", event: eventType }, 200);
  }

  const notification = applyTemplate(template, body);
  const recipient = integration.to ?? undefined;
  const results: { id: string; channel: string; status: string; error?: string }[] = [];

  for (const ch of integration.channels) {
    const adapter = getChannelAdapter(ch);
    let status: "success" | "failed" = "success";
    let error: string | null = null;

    try {
      await adapter.deliver(notification, recipient);
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
      console.error(`[webhook] ${integration.provider}/${eventType} → ${ch} failed:`, error);
    }

    const log = await pb.collection("notification_logs").create({
      integration_id: integration.id,
      channel: ch,
      status,
      notification,
      recipient: recipient ?? null,
      error,
    });

    results.push({ id: log.id, channel: ch, status, ...(error ? { error } : {}) });
  }

  const anyFailed = results.some((r) => r.status === "failed");
  return c.json({ results }, anyFailed ? 502 : 200);
});
