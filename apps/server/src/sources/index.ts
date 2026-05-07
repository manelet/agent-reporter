import { customApiSource } from "./custom-api.js";
import type { SourceAdapter } from "./types.js";

export const sourceAdapters: Record<string, SourceAdapter> = {
  [customApiSource.type]: customApiSource as SourceAdapter,
};

export function getSourceAdapter(type: string): SourceAdapter {
  const adapter = sourceAdapters[type];
  if (!adapter) {
    throw new Error(`unknown source type: ${type}`);
  }
  return adapter;
}

export type * from "./types.js";
export { customApiSource } from "./custom-api.js";
export type { CustomApiConfig, CustomApiPayload } from "./custom-api.js";
