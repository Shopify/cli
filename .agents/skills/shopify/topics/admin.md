# Admin GraphQL API

Server-side API for reading/writing shop data: products, orders, customers, inventory, metafields, discounts, webhooks, bulk operations.

## Key facts

- Latest stable version: `2026-07`. Quarterly releases; supported: `2025-10`, `2026-01`, `2026-04`, `2026-07`. Requests to a retired version silently fall forward to the oldest supported one — always pin the version. Endpoint: `POST https://{shop}.myshopify.com/admin/api/2026-07/graphql.json` with headers `X-Shopify-Access-Token: {token}` and `Content-Type: application/json`.
- REST Admin API is legacy since Oct 1, 2024. Build everything on GraphQL; `/products.json`, `/variants.json` etc. are deprecated.
- Product model: `ProductInput.variants` and `.options` were removed (deprecated 2024-04). Define options via `productOptions` on `productCreate`; manage variants with `productVariantsBulkCreate|Update|Delete`, options with `productOptionsCreate`/`productOptionUpdate`/`productOptionsDelete`, or do a full declarative sync with `productSet`. Limit: 2048 variants per product.
- `productCreate` creates an UNPUBLISHED product with only its default variant; publish with `publishablePublish`.
- Inventory: the `@idempotent(key:)` directive (UUID key) is REQUIRED on `inventorySetQuantities` and `inventoryAdjustQuantities` since `2026-04`. `compareQuantity`/`ignoreCompareQuantity` were removed: each `quantities` item takes a mandatory `changeFromQuantity` (current expected qty for compare-and-swap, or explicit `null` to skip; mismatch fails with `CHANGE_FROM_QUANTITY_STALE`).
- Metafields: write with `metafieldsSet` — there is no metafieldCreate/Update. Max 25 metafields per call, 10MB payload, atomic. `type` is required unless a definition exists for namespace+key+owner type. Optional `compareDigest` per metafield gives CAS safety. Omitting `namespace` uses the app-reserved namespace. `value` is always a string, even for types like `number_integer`, `boolean`, `json`, `list.single_line_text_field`, `product_reference`.
- Webhooks: `WebhookSubscriptionInput.uri` (accepts `https://`, Pub/Sub, EventBridge ARN) replaced `callbackUrl`. Payload API version is configured app-wide, never per subscription. Prefer app-specific subscriptions in `shopify.app.toml` `[webhooks]` over this mutation.
- `currentBulkOperation` is deprecated → use `bulkOperation(id:)` or `bulkOperations(first:, query: "status:completed")` — no `status:` argument; filter via `query:`.
- Since `2026-01` an app can run up to 5 bulk operations of each type (query/mutation) per shop concurrently (previously 1 per type).
- `DiscountCodeBasicInput.customerSelection` is deprecated → use `context`.
- Every ID is a GID string, e.g. `"gid://shopify/Product/123"` — never bare integers.

## Core surface

| Query | Purpose |
|---|---|
| `shop` | Store settings, plan, currency |
| `products` / `product(id)` | List (supports `query:` filter) / fetch one |
| `orders` / `order(id)` | Orders; `read_orders` covers last 60 days only, older needs `read_all_orders` |
| `customers` / `customer(id)` | Customer records |
| `draftOrders`, `collections`, `collectionByIdentifier(identifier: {handle:})` | Drafts; collections by id/handle |
| `inventoryItems`, `locations` | Inventory items and stock locations |
| `metaobjects(type:)`, `metafieldDefinitions` | Custom data reads |
| `webhookSubscriptions`, `bulkOperations`, `files`, `companies` | Subscriptions, bulk job status, uploads, B2B |
| `publicApiVersions` | Supported API versions |

| Mutation | Purpose |
|---|---|
| `productCreate` / `productUpdate` / `productDelete` | Product CRUD (single default variant on create) |
| `productSet` | Declarative upsert of product+options+variants (sync use case) |
| `productVariantsBulkCreate` / `Update` / `Delete` | Variant management (up to 250/call) |
| `publishablePublish` | Publish product/collection to a sales channel |
| `tagsAdd` / `tagsRemove` | Tag any taggable resource |
| `metafieldsSet` / `metafieldsDelete` / `metafieldDefinitionCreate` | Metafield writes |
| `metaobjectDefinitionCreate` / `metaobjectUpsert` | Custom data models |
| `inventorySetQuantities` / `inventoryAdjustQuantities` | Absolute set / delta adjust (both need `@idempotent`) |
| `orderCreate` / `orderUpdate` | Import orders (max one discount code; automatic discounts not applied) / simple edits |
| `orderEditBegin` → edit → `orderEditCommit` | Line-item level order editing session |
| `draftOrderCreate` / `draftOrderComplete` | Draft order flow |
| `fulfillmentCreate` | Fulfill via `lineItemsByFulfillmentOrder` (FulfillmentOrder-based, not order-based) |
| `discountCodeBasicCreate` / `discountAutomaticBasicCreate` | Discounts |
| `stagedUploadsCreate` → HTTP upload → `fileCreate` | File/media upload flow |
| `webhookSubscriptionCreate` / `Update` / `Delete` | Webhook management |
| `bulkOperationRunQuery` / `bulkOperationRunMutation` / `bulkOperationCancel` | Async bulk export/import |
| `customerCreate` / `customerUpdate` | Customer CRUD |

## Examples (validated against the 2026-04 schema)

Filtered, paginated query — connections require `first` or `last` (max 250); page forward with `pageInfo.endCursor` → `after:`, backward with `startCursor` → `before:` + `last:`:

```graphql
query {
  products(first: 50, query: "status:active created_at:>2026-01-01") {
    nodes { id title variants(first: 10) { nodes { id sku price } } }
    pageInfo { hasNextPage endCursor }
  }
}
```

Create product with options (variants come after, via `productVariantsBulkCreate`):

```graphql
mutation {
  productCreate(product: {
    title: "Trail Runner Sock"
    status: ACTIVE
    productOptions: [{name: "Size", values: [{name: "S"}, {name: "M"}]}]
  }) {
    product { id options { name optionValues { name } } }
    userErrors { field message }
  }
}
```

Set metafields (upsert semantics):

```graphql
mutation {
  metafieldsSet(metafields: [{
    ownerId: "gid://shopify/Product/1234567890"
    namespace: "custom"
    key: "care_guide"
    type: "single_line_text_field"
    value: "Machine wash cold"
  }]) {
    metafields { id key value }
    userErrors { field message code }
  }
}
```

Set inventory with required idempotency key and CAS:

```graphql
mutation {
  inventorySetQuantities(input: {
    name: "available"
    reason: "correction"
    quantities: [{inventoryItemId: "gid://shopify/InventoryItem/30322695", locationId: "gid://shopify/Location/124656943", quantity: 42, changeFromQuantity: 40}]
  }) @idempotent(key: "8f14e45f-ceea-4670-8a54-4c1b2f7e9d3a") {
    inventoryAdjustmentGroup { changes { name delta } }
    userErrors { field message code }
  }
}
```

## Rate limits and cost

- Cost-based leaky bucket per app+store: 100 points/s (Standard), 200 (Advanced), 1000 (Plus), 2000 (Enterprise). Field costs: scalar/enum 0, object 1, mutation 10, connection sized by `first`/`last`. Single request cap: 1000 points (pre-execution, on requested cost; refunded down to actual cost).
- Throttled requests return a top-level `errors` entry with `extensions.code: THROTTLED` (HTTP still 200). Read `extensions.cost.throttleStatus { maximumAvailable currentlyAvailable restoreRate }` and back off.
- Input arrays max 250 items. Pagination capped at 25,000 objects; count fields return 25,001 to mean "more than 25,000". Use bulk operations beyond that.
- Resource throttles: stores over 50k variants get 1000 new variants/day (`productCreate`/`productUpdate`/`productVariantCreate`); dev/trial stores: max 5 `orderCreate`/min.

## Search syntax (`query:` argument)

`field:value` terms; bare space = `AND`, explicit `OR`; negate with `-` or `NOT`; comparators `:>` `:<` `:>=` `:<=`; ranges by combining; prefix wildcard `norm*`; existence `published_at:*` (negate for missing); quote phrases `title:"Trail Runner"`; escape `: \ ( )` with backslash. Filterable fields are listed per connection in the reference docs.

## Bulk operations

`bulkOperationRunQuery(query: "...")` wraps any single top-level connection query (nested connections allowed, no `first` needed). Poll `bulkOperation(id:)` / `bulkOperations` or subscribe to webhook topic `bulk_operations/finish`; when `status: COMPLETED`, download JSONL from `url` (expires after 7 days; `partialDataUrl` on failure). Imports: upload JSONL of variables via `stagedUploadsCreate` (resource `BULK_MUTATION_VARIABLES`), then `bulkOperationRunMutation(mutation:, stagedUploadPath:)`. `@idempotent` in a bulk mutation reads its key per JSONL row.

## Errors, auth, validation

- Mutations return errors in `userErrors { field message code }` with HTTP 200 — always select and check it; a missing check is the top integration bug.
- Access scopes are declared in `shopify.app.toml`: `[access_scopes] scopes = "read_products,write_products"`. The offline validator prints the exact scopes an operation needs: `shopify validate graphql --api admin --file op.graphql` (add `--version 2026-07` to target a specific version).
- Common validation failures: bare integer IDs instead of GIDs, missing `first:` on a connection, selecting scalars' subfields, using removed `ProductInput.variants`, omitting `@idempotent` on inventory mutations.

## Docs

https://shopify.dev/docs/api/admin-graphql/latest
https://shopify.dev/docs/api/usage/limits
https://shopify.dev/docs/api/usage/pagination-graphql
https://shopify.dev/docs/api/usage/search-syntax
https://shopify.dev/docs/api/usage/versioning
https://shopify.dev/docs/api/usage/bulk-operations/queries
https://shopify.dev/docs/api/usage/idempotent-requests
https://shopify.dev/docs/apps/build/graphql/migrate/learn-how
