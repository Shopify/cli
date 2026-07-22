# @shopify/shopify-dev-tools

Core GraphQL utilities for Shopify Dev MCP. This package provides the foundational functionality for GraphQL schema introspection and validation without MCP server dependencies.

## Installation

```bash
npm install @shopify/shopify-dev-tools
```

## Features

- **Schema Discovery**: Fetch available Shopify GraphQL schemas with memoization
- **Schema Introspection**: Query and explore GraphQL schema definitions with formatted results
- **GraphQL Validation**: Validate GraphQL operations against schemas
- **HTTP Utilities**: Optimized client for Shopify dev server communication

## Usage

### Schema Discovery

```typescript
import { fetchGraphQLSchemas } from "@shopify/shopify-dev-tools";

// Fetch available schemas from Shopify (with memoization)
const { schemas, apis, versions, latestVersion } = await fetchGraphQLSchemas();

console.log(`Available APIs: ${apis.map((api) => api.name).join(", ")}`);
console.log(`Latest version: ${latestVersion}`);
console.log(`All versions: ${versions.join(", ")}`);
```

### Schema Introspection

```typescript
import { introspectGraphqlSchema } from "@shopify/shopify-dev-tools";

// Introspect schema with search term (uses default/latest version)
const result = await introspectGraphqlSchema("product", "admin");

// Or with specific version and schemas
const resultWithVersion = await introspectGraphqlSchema("product", "admin", {
  schemaOptions: {
    version: "2025-07",
    schemas: customSchemaArray, // Use fetchGraphQLSchemas() to get these
  },
  filter: ["types", "queries"], // Optional: "all", "types", "queries", "mutations"
});

if (result.success) {
  console.log(result.responseText);
  // Returns formatted markdown with:
  // - Matching GraphQL Types (limited to 10 results)
  // - Matching GraphQL Queries
  // - Matching GraphQL Mutations
}
```

### GraphQL Validation

```typescript
import {
  validateGraphQLOperation,
  hasFailedValidation,
  ValidationResult,
} from "@shopify/shopify-dev-tools/validation";

const query = `
  query getProduct($id: ID!) {
    product(id: $id) {
      title
      description
      variants(first: 10) {
        edges {
          node {
            price
          }
        }
      }
    }
  }
`;

// Validate using default bundled schemas
const validation = await validateGraphQLOperation(query, "admin");

// Or validate with specific version and schemas
const validationWithOptions = await validateGraphQLOperation(query, "admin", {
  version: "2025-07",
  schemas: customSchemas,
});

if (validation.result === ValidationResult.SUCCESS) {
  console.log("Query is valid!");
  console.log(validation.resultDetail);
} else {
  console.error("Validation failed:", validation.resultDetail);
}

// Check multiple validations
const responses = [validation1, validation2, validation3];
if (hasFailedValidation(responses)) {
  console.error("At least one validation failed");
}
```

### HTTP Utilities

```typescript
import { shopifyDevFetch } from "@shopify/shopify-dev-tools/http";

// Make requests to Shopify dev server
const response = await shopifyDevFetch("/assistant/search", {
  parameters: { q: "products", limit: "10" },
  headers: { "Custom-Header": "value" },
  method: "GET",
  instrumentation: {
    packageVersion: "1.0.0",
    timestamp: new Date().toISOString(),
  },
});

// Supports full URLs or relative paths
const data = await shopifyDevFetch("https://shopify.dev/api/data");
```

### Type Definitions

```typescript
import {
  ValidationResult,
  ValidationResponse,
  ValidationToolResult,
  Schema,
} from "@shopify/shopify-dev-tools/types";

// Use typed enums
if (response.result === ValidationResult.SUCCESS) {
  // Handle success
}

// Type your responses
const response: ValidationResponse = {
  result: ValidationResult.FAILED,
  resultDetail: "Invalid field 'unknownField' on type 'Product'",
};

// Schema type
const schema: Schema = {
  api: "admin",
  id: "admin_2025-07",
  version: "2025-07",
  url: "/mcp/graphql_schemas/admin_2025-07.json",
};
```

## API Reference

### Main Exports

The package provides multiple export paths for optimal tree-shaking:

| Export Path                                | Description                  |
| ------------------------------------------ | ---------------------------- |
| `@shopify/shopify-dev-tools`               | Main entry with all exports  |
| `@shopify/shopify-dev-tools/graphql`       | Schema discovery             |
| `@shopify/shopify-dev-tools/introspection` | Schema introspection         |
| `@shopify/shopify-dev-tools/validation`    | GraphQL operation validation |
| `@shopify/shopify-dev-tools/types`         | TypeScript type definitions  |
| `@shopify/shopify-dev-tools/http`          | HTTP client utilities        |

### Key Functions

#### GraphQL Module

- `fetchGraphQLSchemas()` - Fetch available schemas from Shopify with memoization

#### Introspection Module

- `introspectGraphqlSchema(query, api, options?)` - Search and introspect schema

#### Validation Module

- `validateGraphQLOperation(code, api, options?)` - Validate GraphQL operations
- `hasFailedValidation(responses)` - Check if any validation failed

#### HTTP Module

- `shopifyDevFetch(uri, options?)` - Make requests to Shopify dev server

### Environment Variables

- `DEV` — When truthy (anything other than the literal string `"false"`), routes requests to `https://shopify-dev.shop.dev/` instead of `https://shopify.dev/`.
- `SHOPIFY_DEV_STAGING_SERVER_NUMBER` — When set to a positive integer `N`, routes requests to the Minerva-fronted staging host `https://shopify-dev-staging${N}.shopifycloud.com/`. Used both by the MCP's `search_docs_chunks` tool and by the agent-skill `search_docs`/instrumentation scripts. Requires a Minerva token via `MINERVA_TOKEN`; otherwise the first request throws. Takes precedence over `DEV`.
- `MINERVA_TOKEN` — Bare JWT sent as `Cookie: MINERVA_TOKEN=<value>` to authenticate against Minerva. Required whenever `SHOPIFY_DEV_STAGING_SERVER_NUMBER` is set; the resolver throws immediately if it's missing. Obtain a value via `export MINERVA_TOKEN=$(devx minerva-auth --client-id 0oa1bphetnkOusboI0x8 --audience https://shopify-dev-staging${N}.shopifycloud.com)`.
- `SHOPIFY_DEV_INSTRUMENTATION_URL` — Internal escape hatch used by the evals harness to point telemetry (`POST /mcp/usage`) at an arbitrary URL (typically `http://127.0.0.1:0/` to suppress real telemetry). Scoped to the `/mcp/usage` path only — does not affect search calls. Loses to `SHOPIFY_DEV_STAGING_SERVER_NUMBER`.
