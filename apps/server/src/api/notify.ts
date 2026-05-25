import { createHash } from "node:crypto";
import { apiNotifySchema } from "@reporter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getServerPb } from "../pb.js";
import { getChannelAdapter } from "../channels/index.js";

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export const notifyRoutes = new Hono().post("/", async (c) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "missing bearer token" });
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    throw new HTTPException(401, { message: "missing bearer token" });
  }

  const pb = await getServerPb();
  const hash = hashToken(token);

  let keyRow: { id: string; revoked_at: string | null };
  try {
    keyRow = (await pb
      .collection("api_keys")
      .getFirstListItem(`token_hash="${hash}"`)) as unknown as typeof keyRow;
  } catch {
    throw new HTTPException(401, { message: "invalid api key" });
  }
  if (keyRow.revoked_at) {
    throw new HTTPException(401, { message: "api key revoked" });
  }

  const parsed = apiNotifySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: JSON.stringify(parsed.error.flatten()),
    });
  }

  void pb
    .collection("api_keys")
    .update(keyRow.id, { last_used_at: new Date().toISOString() })
    .catch((e: unknown) => {
      console.error("[notify] failed to update last_used_at", e);
    });

  const { channel, notification, to } = parsed.data;
  const adapter = getChannelAdapter(channel);
  const recipient = to ?? null;

  let status: "success" | "failed" = "success";
  let error: string | null = null;

  try {
    await adapter.deliver(notification, to);
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.error(`[notify] ${channel} delivery failed:`, error);
  }

  const log = await pb.collection("notification_logs").create({
    token_id: keyRow.id,
    channel,
    status,
    notification,
    recipient,
    error,
  });

  if (status === "failed") {
    return c.json({ id: log.id, status, error }, 502);
  }
  return c.json({ id: log.id, status });
});
