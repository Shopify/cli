/**
 * Registry of internal-only topic IDs. Sourced from internal-api-ids.json so that
 * dev-mcp's vite.config.js can read the same canonical list at build
 * time without parsing TypeScript.
 *
 * Adding an internal API: add the entry to internal-api-ids.json. Both
 * this module and vite.config.js pick it up automatically.
 */

import internalApiIdsJson from "./internal-api-ids.json" with { type: "json" };

export const INTERNAL_API_IDS = internalApiIdsJson as Readonly<
  typeof internalApiIdsJson
>;

export type InternalApiIds =
  (typeof INTERNAL_API_IDS)[keyof typeof INTERNAL_API_IDS];
