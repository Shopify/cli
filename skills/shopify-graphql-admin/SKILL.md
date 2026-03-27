---
name: shopify-graphql-admin
description: "Mental models and gotchas for Shopify's Admin GraphQL API — what differs from standard GraphQL assumptions"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Admin GraphQL API

## Mental Model: How Shopify GraphQL Differs

**Cost-based, not request-count rate limiting.** Every query has a calculated cost in points. Your app gets a bucket (default 1000 points) that refills at a steady rate (50 pts/sec on standard plans). A single query cannot exceed 1000 points regardless of plan. Check `extensions.cost` in every response for `requestedQueryCost`, `actualQueryCost`, and `currentlyAvailable`.

**Everything is a GID.** All resource IDs are Global IDs in the format `gid://shopify/<ResourceType>/<numeric_id>` (e.g., `gid://shopify/Product/123456`). Mutations accept GIDs, not numeric IDs. When interfacing with REST or webhooks that provide numeric IDs, you must construct the GID yourself.

**Date-based API versioning.** Versions are named `YYYY-MM` (e.g., `2026-01`), released quarterly (Jan/Apr/Jul/Oct). Each version is supported for 12 months minimum. Always pin to a stable version in the URL: `/admin/api/2026-01/graphql.json`. Never use `unstable` in production.

**HTTP 200 does not mean success.** GraphQL responses almost always return 200 OK. Errors come in two places: top-level `errors` array (query/syntax problems, throttling, auth) and `userErrors` array inside mutation responses (business logic failures). You must check both.

## Gotchas

### Error Handling
- **`userErrors` is not an exception** — it's a field you must explicitly request and check in every mutation response. It returns `[]` on success.
- **`THROTTLED` comes as a 200** with `extensions.code: "THROTTLED"`, not a 429. Retry after checking `extensions.cost.currentlyAvailable`.
- Top-level `errors` array indicates malformed queries or server issues. `userErrors` indicates the mutation was syntactically valid but the operation was rejected.

### Pagination
- **Max page size is 250** (`first: 250` or `last: 250`). Default is typically 50.
- **Max traversal is ~25,000 objects** via pagination. For larger datasets, use bulk operations instead.
- Always request `pageInfo { hasNextPage endCursor }` and loop with `after: endCursor`.
- Cursor values are opaque strings — never parse, store long-term, or assume format stability.

### Rate Limits
- **Requested cost** is deducted upfront based on worst-case fields; **actual cost** (often lower) triggers a partial refund.
- Connections multiply cost: `products(first: 50) { variants(first: 50) }` costs ~2,500 points (50 x 50), likely exceeding the 1000-point single-query cap.
- Add header `Shopify-GraphQL-Cost-Debug: 1` during development to get field-level cost breakdowns.
- Input arrays are capped at 250 items per argument.

### Bulk Operations
- **Don't paginate millions of records** — use `bulkOperationRunQuery` instead. It bypasses cost limits and runs asynchronously.
- Results are JSONL (one JSON object per line). Nested resources use `__parentId` to reference their parent.
- API 2026-01+ allows 5 concurrent bulk ops per shop; earlier versions allow only 1.
- Bulk ops can take hours/days. Use offline access tokens (online tokens expire in 24 hours).
- `first`, `after`, and `pageInfo` are ignored in bulk query strings — the system fetches everything.

## Key Patterns

### Pagination Template
```graphql
query Products($cursor: String) {
  products(first: 50, after: $cursor) {
    edges {
      node {
        id
        title
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
# Loop: while hasNextPage, pass endCursor as $cursor
```

### Mutation with Proper Error Handling
```graphql
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
    }
    userErrors {
      field
      message
      code
    }
  }
}
# ALWAYS check: response.data.productUpdate.userErrors.length === 0
```

### Bulk Operation Workflow
```
1. CREATE — bulkOperationRunQuery(query: "...")
   → Returns bulkOperation.id and status
2. POLL  — query bulkOperation(id: "gid://...") { status url objectCount }
   → Wait for status: COMPLETED (also handle FAILED, CANCELED)
3. FETCH  — HTTP GET the url field → parse JSONL line by line
   → Child objects have __parentId linking to parent's id
```

### GID Construction
```
Format:  gid://shopify/{ResourceType}/{numericId}
Example: gid://shopify/Product/7891011
         gid://shopify/ProductVariant/121314
         gid://shopify/Order/151617
```

## Cost Estimation Cheat Sheet

| Query Shape | Approximate Cost |
|---|---|
| Single object by ID | 1-2 points |
| List of 50 objects | ~52 points |
| List of 50 + nested list of 10 each | ~552 points |
| List of 50 + nested list of 50 each | ~2,502 points (likely over limit) |
| Mutation (flat) | 10 points |

**Rule of thumb:** cost ~ sum of all objects that _could_ be returned. Flatten nested connections or reduce `first` to stay under 1,000.

## Documentation Pointers

- **API Reference & Schema:** https://shopify.dev/docs/api/admin-graphql
- **Rate Limits:** https://shopify.dev/docs/api/usage/rate-limits
- **Bulk Operations:** https://shopify.dev/docs/api/usage/bulk-operations
- **Pagination:** https://shopify.dev/docs/api/usage/pagination-graphql
- **Versioning:** https://shopify.dev/docs/api/usage/versioning
- **Access Scopes:** https://shopify.dev/docs/api/usage/access-scopes
- **GraphiQL Explorer:** https://shopify.dev/apps/tools/graphiql-admin-api
- **Schema introspection:** Use standard GraphQL introspection queries against the versioned endpoint
