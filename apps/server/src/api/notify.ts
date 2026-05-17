import { createHash } from "node:crypto";
import { apiNotifySchema } from "@agent-reporter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getServerPb } from "../pb.js";
import { executeApiNotification } from "../runner.js";

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// POST /api/notify — bearer-authenticated direct entrypoint. No source/no
// report; the caller submits a Notification and a list of channel ids.
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

  // Best-effort update; failures here shouldn't block the delivery.
  void pb
    .collection("api_keys")
    .update(keyRow.id, { last_used_at: new Date().toISOString() })
    .catch((e: unknown) => {
      console.error("[notify] failed to update last_used_at", e);
    });

  try {
    const outcome = await executeApiNotification(
      parsed.data.channels,
      parsed.data.notification,
      pb,
    );
    return c.json(outcome);
  } catch (e) {
    console.error("[notify] delivery failed", e);
    throw new HTTPException(500, {
      message: e instanceof Error ? e.message : "delivery failed",
    });
  }
});
