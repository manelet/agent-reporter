import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  sourceCreateSchema,
  sourceUpdateSchema,
} from "@agent-reporter/shared";
import { decryptConfig, encryptConfig, redactConfig } from "../crypto.js";
import { sourceAdapters } from "../sources/index.js";

const COLLECTION = "sources";

export const sourcesRoutes = new Hono()
  // Metadata about every registered source adapter. Used by the admin to
  // know which form fields to show, whether to ask for a template, etc.
  // Mounted before /:id so it doesn't get swallowed by the param route.
  .get("/types", (c) =>
    c.json(
      Object.values(sourceAdapters).map((a) => ({
        type: a.type,
        mode: a.mode,
        emitsNotification: a.emitsNotification,
      })),
    ),
  )
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
    const parsed = sourceCreateSchema.safeParse(
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
    const parsed = sourceUpdateSchema.safeParse(
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
