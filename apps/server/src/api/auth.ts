import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { loginSchema } from "@reporter/shared";
import { pb } from "../pb.js";

export const authRoutes = new Hono().post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    throw new HTTPException(400, { message: "invalid login payload" });
  }
  try {
    const result = await pb
      .collection("_superusers")
      .authWithPassword(body.data.email, body.data.password);
    return c.json({
      token: result.token,
      user: { id: result.record.id, email: result.record.email },
    });
  } catch {
    throw new HTTPException(401, { message: "invalid credentials" });
  }
});
