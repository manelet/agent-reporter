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
  // Listen port. portless injects PORT (random 4000-4999); without portless
  // we fall back to 3000.
  PORT: z.coerce.number().int().positive().default(3000),
  SERVER_HOST: z.string().default("127.0.0.1"),
  // Origin allowed by CORS. With portless this is the admin's stable URL;
  // override to http://127.0.0.1:5173 if running Vite without portless.
  ADMIN_ORIGIN: z.string().url().default("https://agent-reporter.localhost"),
  CRON_TIMEZONE: z.string().default("Europe/Madrid"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
