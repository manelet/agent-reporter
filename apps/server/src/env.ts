import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load .env from the workspace root regardless of where the process is started.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

const envSchema = z.object({
  AGENT_REPORTER_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex chars (32 bytes)"),
  PB_URL: z.string().url().default("http://127.0.0.1:8090"),
  PB_ADMIN_EMAIL: z.string().email(),
  PB_ADMIN_PASSWORD: z.string().min(1),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  SERVER_HOST: z.string().default("127.0.0.1"),
  ADMIN_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
  CRON_TIMEZONE: z.string().default("Europe/Madrid"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
