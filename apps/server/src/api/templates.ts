import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { renderEmail, renderTelegram } from "../channels/render.js";
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
      const shouldDeliver = t.shouldDeliver(data);
      const notification = shouldDeliver ? t.render(data) : null;
      return c.json({
        data,
        shouldDeliver,
        notification,
        // Convenience: also return the per-channel renders so the admin
        // preview can show what each channel will look like without having
        // to duplicate the render logic in the SPA.
        email: notification ? renderEmail(notification) : null,
        telegram: notification ? renderTelegram(notification) : null,
      });
    } catch {
      throw new HTTPException(404, { message: "template not found" });
    }
  });
