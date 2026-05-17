import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  reportCreateSchema,
  reportUpdateSchema,
} from "@agent-reporter/shared";
import { decrypt, encrypt } from "../crypto.js";
import { executeReport } from "../runner.js";
import { reloadSchedules } from "../scheduler.js";
import { getSourceAdapter } from "../sources/index.js";
import { getTemplate } from "../templates/index.js";
import type PocketBase from "pocketbase";

// Cross-validate template_id against the source's emitsNotification flag.
// Sources that emit Notification directly must NOT have a template; sources
// that don't must have one whose sourceType matches.
async function validateTemplateForSource(
  pb: PocketBase,
  sourceId: string,
  templateId: string | null | undefined,
): Promise<void> {
  const sourceRow = await pb.collection("sources").getOne(sourceId);
  const adapter = getSourceAdapter(sourceRow.type);
  if (adapter.emitsNotification) {
    if (templateId) {
      throw new HTTPException(400, {
        message: `source "${adapter.type}" emits Notification directly; template_id must be empty`,
      });
    }
    return;
  }
  if (!templateId) {
    throw new HTTPException(400, {
      message: `source "${adapter.type}" requires a template_id`,
    });
  }
  let template;
  try {
    template = getTemplate(templateId);
  } catch {
    throw new HTTPException(400, {
      message: `unknown template_id "${templateId}"`,
    });
  }
  if (template.sourceType !== adapter.type) {
    throw new HTTPException(400, {
      message: `template "${template.id}" expects source type "${template.sourceType}" but source is "${adapter.type}"`,
    });
  }
}

const COLLECTION = "reports";

interface ShapeOpts {
  revealSecret?: boolean;
}

function shapeReport(row: Record<string, unknown>, opts: ShapeOpts = {}) {
  const out: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    source: row.source,
    channels: row.channels ?? [],
    template_id: row.template_id || null,
    params: row.params ?? {},
    trigger: row.trigger,
    cron: row.cron || null,
    webhook_secret_status: row.webhook_secret ? "set" : "unset",
    enabled: !!row.enabled,
    created: row.created,
    updated: row.updated,
  };
  // The webhook URL is path-only; the admin (and the user setting up GH)
  // prepends the public host. We can't know it server-side without an env
  // var the user must keep in sync.
  if (row.trigger === "webhook") {
    out.webhook_path = `/webhooks/${row.id}`;
    if (opts.revealSecret && typeof row.webhook_secret === "string") {
      out.webhook_secret = decrypt(row.webhook_secret);
    }
  }
  return out;
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
    const reveal = c.req.query("reveal") === "true";
    const row = await pb.collection(COLLECTION).getOne(id);
    return c.json(shapeReport(row as never, { revealSecret: reveal }));
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
    await validateTemplateForSource(pb, data.source, data.template_id ?? null);
    const create: Record<string, unknown> = {
      name: data.name,
      source: data.source,
      channels: data.channels,
      template_id: data.template_id ?? "",
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
    if ("template_id" in patch && patch.template_id == null) {
      patch.template_id = "";
    }
    // Re-validate template ↔ source whenever either changes.
    if (patch.source !== undefined || "template_id" in patch) {
      const current = await pb.collection(COLLECTION).getOne(id);
      const sourceId = (patch.source as string | undefined) ?? current.source;
      const templateId =
        "template_id" in patch
          ? ((patch.template_id as string | null) || null)
          : ((current.template_id as string | null) || null);
      await validateTemplateForSource(pb, sourceId, templateId);
    }
    // Switching trigger to webhook on a report that didn't have one needs a
    // freshly generated secret.
    if (patch.trigger === "webhook") {
      const current = await pb.collection(COLLECTION).getOne(id);
      if (!current.webhook_secret) {
        patch.webhook_secret = encrypt(randomBytes(32).toString("hex"));
      }
    }
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
  .post("/:id/regenerate-secret", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const newSecret = randomBytes(32).toString("hex");
    await pb
      .collection(COLLECTION)
      .update(id, { webhook_secret: encrypt(newSecret) });
    return c.json({ webhook_secret: newSecret });
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
