import { Hono } from "hono";

export const notificationLogsRoutes = new Hono().get("/", async (c) => {
  const pb = c.get("pb");
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Number(c.req.query("perPage") ?? 50);
  const list = await pb.collection("notification_logs").getList(page, perPage, {
    sort: "-created",
  });
  return c.json({
    items: list.items,
    page: list.page,
    perPage: list.perPage,
    totalItems: list.totalItems,
  });
});
