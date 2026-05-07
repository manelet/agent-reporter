import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { pbWithToken } from "./pb.js";

declare module "hono" {
  interface ContextVariableMap {
    pb: ReturnType<typeof pbWithToken>;
    userId: string;
  }
}

export async function requireAuth(c: Context, next: Next): Promise<void> {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "missing bearer token" });
  }
  const token = auth.slice("Bearer ".length).trim();
  const pb = pbWithToken(token);
  try {
    // Refresh validates the token against PocketBase. Throws if invalid.
    await pb.collection("_superusers").authRefresh();
  } catch {
    throw new HTTPException(401, { message: "invalid or expired token" });
  }
  c.set("pb", pb);
  c.set("userId", pb.authStore.record?.id ?? "");
  await next();
}
