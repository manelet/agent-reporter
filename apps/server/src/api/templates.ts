import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getTemplate, listTemplates } from "../templates/index.js";

export const templatesRoutes = new Hono()
  .get("/", (c) => c.json(listTemplates()))
  .get("/:id", (c) => {
    const id = c.req.param("id");
    try {
      const t = getTemplate(id);
      return c.json({
        id: t.id,
        description: t.description,
        sourceType: t.sourceType,
      });
    } catch {
      throw new HTTPException(404, { message: "template not found" });
    }
  })
  .get("/:id/preview", (c) => {
    const id = c.req.param("id");
    try {
      const t = getTemplate(id);
      const data = t.mockData();
      return c.json({
        data,
        shouldDeliver: t.shouldDeliver(data),
        email: t.renderEmail(data),
        telegram: t.renderTelegram(data),
      });
    } catch {
      throw new HTTPException(404, { message: "template not found" });
    }
  });
