import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "./env.js";

// AES-256-GCM with random 12-byte IV. Output is base64 of: iv | tag | ciphertext.
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

const masterKey = Buffer.from(env.AGENT_REPORTER_MASTER_KEY, "hex");
if (masterKey.length !== 32) {
  throw new Error("AGENT_REPORTER_MASTER_KEY must decode to 32 bytes");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(packed: string): string {
  const buf = Buffer.from(packed, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// Encrypts string-valued leaves of a config object. Used for source/channel
// configs where every value is a credential that must round-trip cleanly.
export function encryptConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === "string" ? encrypt(v) : v;
  }
  return out;
}

export function decryptConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === "string" ? decrypt(v) : v;
  }
  return out;
}

// Returns a redacted view: every string value becomes "••••••" so the admin
// can list configs without exposing secrets unless explicitly revealed.
export function redactConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === "string" ? "••••••" : v;
  }
  return out;
}
