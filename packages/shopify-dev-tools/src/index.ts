/**
 * @shopify/shopify-dev-tools
 *
 * Core GraphQL utilities for Shopify Dev MCP
 * This package provides the core functionality for GraphQL schema
 * introspection and validation without MCP server dependencies.
 */

// Export public API functions and types
export {
  formatScopes,
  loadAPISchema,
  loadAPISchemas,
  type APIVersionWithAPI,
} from "./schemaOperations/index.js";
export { loadSchemaContent } from "./schemaOperations/loadSchemaContent.js";

export {
  // Introspection
  introspectGraphqlSchema,
  type GraphQLSchemaItem,
  type IntrospectionOptions,
  type IntrospectionResult,
} from "./introspection/index.js";

export {
  hasFailedValidation,
  // Validation
  validateGraphQLOperation,
  type GraphQLValidationOptions,
} from "./validation/index.js";
// Export all types (keep full exports for types)
export * from "./types/index.js";

export {
  // HTTP
  shopifyDevFetch,
  type ShopifyDevFetchOptions,
} from "./http/index.js";

export { validateComponentCodeBlock } from "./validation/validateComponentCodeBlock";
