import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { integrationCreateSchema, integrationUpdateSchema } from "@reporter/shared";
import { getServerPb } from "../pb.js";
import { getProvider } from "../integrations/providers/index.js";

export const integrationsRoutes = new Hono()
  .get("/", async (c) => {
    const pb = await getServerPb();
    const list = await pb
      .collection("integrations")
      .getFullList({ sort: "-created" });
    return c.json(list);
  })

  .post("/", async (c) => {
    const parsed = integrationCreateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }

    const { name, provider: providerType, channels, to, secret } = parsed.data;
    const provider = getProvider(providerType);

    const pb = await getServerPb();
    const record = await pb.collection("integrations").create({
      name,
      provider: providerType,
      channels,
      to: to ?? null,
      secret: secret ?? null,
      templates: provider.defaultTemplates,
      enabled: true,
    });

    return c.json(record, 201);
  })

  .patch("/:id", async (c) => {
    const { id } = c.req.param();
    const parsed = integrationUpdateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: JSON.stringify(parsed.error.flatten()),
      });
    }

    const pb = await getServerPb();
    const record = await pb.collection("integrations").update(id, parsed.data);
    return c.json(record);
  })

  .delete("/:id", async (c) => {
    const { id } = c.req.param();
    const pb = await getServerPb();
    await pb.collection("integrations").delete(id);
    return c.json({ ok: true });
  });
