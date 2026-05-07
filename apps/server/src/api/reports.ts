import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  reportCreateSchema,
  reportUpdateSchema,
} from "@agent-reporter/shared";
import { encrypt } from "../crypto.js";
import { executeReport } from "../runner.js";
import { reloadSchedules } from "../scheduler.js";

const COLLECTION = "reports";

function shapeReport(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    channels: row.channels ?? [],
    template_id: row.template_id,
    params: row.params ?? {},
    trigger: row.trigger,
    cron: row.cron || null,
    webhook_secret_status: row.webhook_secret ? "set" : "unset",
    enabled: !!row.enabled,
    created: row.created,
    updated: row.updated,
  };
}

export const reportsRoutes = new Hono()
  .get("/", async (c) => {
    const pb = c.get("pb");
    const list = await pb.collection(COLLECTION).getFullList({
      sort: "-updated",
    });
    return c.json(list.map((r) => shapeReport(r as never)));
  })
  .get("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const row = await pb.collection(COLLECTION).getOne(id);
    return c.json(shapeReport(row as never));
  })
  .post("/", async (c) => {
    const pb = c.get("pb");
    const parsed = reportCreateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }
    const data = parsed.data;
    const create: Record<string, unknown> = {
      name: data.name,
      source: data.source,
      channels: data.channels,
      template_id: data.template_id,
      params: data.params,
      trigger: data.trigger,
      cron: data.cron ?? "",
      enabled: data.enabled,
    };
    // Webhook trigger gets an auto-generated HMAC secret on create.
    if (data.trigger === "webhook") {
      create.webhook_secret = encrypt(randomBytes(32).toString("hex"));
    }
    const row = await pb.collection(COLLECTION).create(create);
    void reloadSchedules().catch((e: unknown) => {
      console.error("[reports] reloadSchedules failed", e);
    });
    return c.json({ id: row.id }, 201);
  })
  .patch("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const parsed = reportUpdateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    if ("cron" in patch && patch.cron === undefined) patch.cron = "";
    await pb.collection(COLLECTION).update(id, patch);
    void reloadSchedules().catch((e: unknown) => {
      console.error("[reports] reloadSchedules failed", e);
    });
    return c.json({ ok: true });
  })
  .delete("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    await pb.collection(COLLECTION).delete(id);
    void reloadSchedules().catch((e: unknown) => {
      console.error("[reports] reloadSchedules failed", e);
    });
    return c.json({ ok: true });
  })
  .post("/:id/run", async (c) => {
    const id = c.req.param("id");
    try {
      const outcome = await executeReport(id, "manual");
      return c.json(outcome);
    } catch (e) {
      throw new HTTPException(500, {
        message: e instanceof Error ? e.message : "run failed",
      });
    }
  });
