/**
 * GraphQL module exports
 *
 * This module provides the main GraphQL-related functionality
 * for external consumers. Internal utilities are not exported.
 */

// Main functions for loading schemas from local files
export {
  loadAPISchema,
  loadAPISchemas,
  type APIVersionWithAPI,
} from "./loadAPISchemas.js";
export { loadSchemaContent } from "./loadSchemaContent.js";
export { schemaCache } from "./schemaCache.js";

// Core types needed by consumers
export type { OfflineScopeData, OfflineScopeEntry } from "./types.js";

export {
  analyzeRequiredOfflineScopes,
  formatScopes,
  getScopes,
} from "./offlineScopes.js";
