import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  channelCreateSchema,
  channelUpdateSchema,
} from "@agent-reporter/shared";
import { decryptConfig, encryptConfig, redactConfig } from "../crypto.js";

const COLLECTION = "channels";

export const channelsRoutes = new Hono()
  .get("/", async (c) => {
    const pb = c.get("pb");
    const list = await pb.collection(COLLECTION).getFullList({
      sort: "-updated",
    });
    return c.json(
      list.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        config: redactConfig((row.config ?? {}) as Record<string, unknown>),
        created: row.created,
        updated: row.updated,
      })),
    );
  })
  .get("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const reveal = c.req.query("reveal") === "true";
    const row = await pb.collection(COLLECTION).getOne(id);
    const config = (row.config ?? {}) as Record<string, unknown>;
    return c.json({
      id: row.id,
      name: row.name,
      type: row.type,
      config: reveal ? decryptConfig(config) : redactConfig(config),
      created: row.created,
      updated: row.updated,
    });
  })
  .post("/", async (c) => {
    const pb = c.get("pb");
    const parsed = channelCreateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }
    const row = await pb.collection(COLLECTION).create({
      name: parsed.data.name,
      type: parsed.data.type,
      config: encryptConfig(parsed.data.config),
    });
    return c.json({ id: row.id }, 201);
  })
  .patch("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const parsed = channelUpdateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.type !== undefined) patch.type = parsed.data.type;
    if (parsed.data.config !== undefined) {
      patch.config = encryptConfig(parsed.data.config);
    }
    await pb.collection(COLLECTION).update(id, patch);
    return c.json({ ok: true });
  })
  .delete("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    await pb.collection(COLLECTION).delete(id);
    return c.json({ ok: true });
  });
