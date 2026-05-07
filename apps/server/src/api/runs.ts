import { Hono } from "hono";

const COLLECTION = "runs";

export const runsRoutes = new Hono()
  .get("/", async (c) => {
    const pb = c.get("pb");
    const reportId = c.req.query("report");
    const filter = reportId ? `report = "${reportId}"` : "";
    const list = await pb.collection(COLLECTION).getList(1, 50, {
      sort: "-created",
      filter,
    });
    return c.json({
      items: list.items,
      page: list.page,
      perPage: list.perPage,
      totalItems: list.totalItems,
    });
  })
  .get("/:id", async (c) => {
    const pb = c.get("pb");
    const id = c.req.param("id");
    const row = await pb.collection(COLLECTION).getOne(id);
    return c.json(row);
  });
