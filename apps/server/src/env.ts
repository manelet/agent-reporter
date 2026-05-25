import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

const envSchema = z.object({
  PB_URL: z.string().url().default("http://127.0.0.1:8090"),
  PB_ADMIN_EMAIL: z.string().email(),
  PB_ADMIN_PASSWORD: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  SERVER_HOST: z.string().default("127.0.0.1"),
  ADMIN_ORIGIN: z.string().url().default("https://reporter.localhost"),

  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().email().optional(),
  RESEND_TO_ADDRESSES: z
    .string()
    .min(1)
    .transform((s) => s.split(",").map((e) => e.trim()))
    .optional(),

  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
