/**
 * Public-only API mapping. This re-export is the **resolver seam** for the
 * dual-bundle isolation pattern: dev-mcp's vite.config.js rewrites resolved
 * imports of this module to ../internal/api-mapping.js when
 * INCLUDE_INTERNAL_APIS=true. Callers in dev-mcp should import from
 * here, never from ../types/api-mapping.js directly — the indirection
 * is what the resolver attaches to.
 *
 * Do not delete this file or replace it with a direct re-export
 * elsewhere; doing so removes the hook the resolver rewrites.
 *
 * See docs/internal-isolation.md for the full pattern.
 */
export {
  SHOPIFY_APIS,
  getVersionedApis,
  isVersionedApi,
} from "../types/api-mapping.js";
