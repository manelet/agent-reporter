import PocketBase from "pocketbase";
import { env } from "./env.js";

export function makePb(): PocketBase {
  return new PocketBase(env.PB_URL);
}

// Used at module scope by routes that don't have a per-request client yet
// (e.g. /api/auth/login).
export const pb = makePb();

export function pbWithToken(token: string): PocketBase {
  const client = makePb();
  client.authStore.save(token, null);
  return client;
}

// Long-lived client authenticated with env superuser credentials. Used by
// the server itself (scheduler, runner) when there is no user request driving
// the action. The PocketBase SDK transparently refreshes on 401 if needed.
let serverClient: PocketBase | null = null;
let serverAuthPromise: Promise<void> | null = null;

async function authServerClient(client: PocketBase): Promise<void> {
  await client
    .collection("_superusers")
    .authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
}

export async function getServerPb(): Promise<PocketBase> {
  if (!serverClient) {
    serverClient = makePb();
    serverClient.autoCancellation(false);
  }
  if (!serverClient.authStore.isValid) {
    if (!serverAuthPromise) {
      serverAuthPromise = authServerClient(serverClient).finally(() => {
        serverAuthPromise = null;
      });
    }
    await serverAuthPromise;
  }
  return serverClient;
}
