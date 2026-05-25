import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiKeyCreateSchema } from "@reporter/shared";

const COLLECTION = "api_keys";

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function shape(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    last_used_at: row.last_used_at || null,
    revoked_at: row.revoked_at || null,
    created: row.created,
    updated: row.updated,
  };
}

// Admin-only CRUD. The plaintext token is returned exactly once (on
// create/rotate). After that only the hash remains in DB.
export const apiKeysRoutes = new Hono()
  .get("/", async (c) => {
    const pb = c.get("pb");
    const list = await pb.collection(COLLECTION).getFullList({
      sort: "-created",
    });
    return c.json(list.map((r) => shape(r as never)));
  })
  .post("/", async (c) => {
    const pb = c.get("pb");
    const parsed = apiKeyCreateSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }
    const plaintext = randomBytes(32).toString("hex");
    const row = await pb.collection(COLLECTION).create({
      name: parsed.data.name,
      token_hash: hashToken(plaintext),
    });
    return c.json({ ...shape(row as never), token: plaintext }, 201);
  })
  .post("/:id/rotate", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const plaintext = randomBytes(32).toString("hex");
    const row = await pb.collection(COLLECTION).update(id, {
      token_hash: hashToken(plaintext),
      // Clear revocation on rotate so the new token is immediately usable.
      revoked_at: null,
      last_used_at: null,
    });
    return c.json({ ...shape(row as never), token: plaintext });
  })
  .post("/:id/revoke", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const row = await pb.collection(COLLECTION).update(id, {
      revoked_at: new Date().toISOString(),
    });
    return c.json(shape(row as never));
  })
  .delete("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    await pb.collection(COLLECTION).delete(id);
    return c.json({ ok: true });
  });
