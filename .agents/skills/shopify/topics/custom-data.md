# Custom data (metafields & metaobjects)
Metafield/metaobject definitions (TOML or GraphQL), reading/writing values via Admin/Storefront APIs, and use in Functions, checkout UI extensions, and Liquid.

## Key facts
- Current stable API version: `2026-07`. `shopify validate graphql` bundles `2026-04`. REST Admin API is legacy — use GraphQL.
- Default pattern: declare app-owned definitions in `shopify.app.toml`, ship with `shopify app deploy`. Use `metafieldDefinitionCreate` / `metaobjectDefinitionCreate` ONLY for merchant-owned or runtime-dynamic schemas; merchant-owned definitions cannot be created in TOML.
- TOML `[product.metafields.app.care_guide]` = namespace `$app`, key `care_guide` at runtime; `[metaobjects.app.author]` = type `$app:author`. `namespace: "app"` is wrong. Omit `namespace` in `metafieldsSet`/`metafield(key:)` — it defaults to `$app`. Sub-namespace: TOML segment `analytics` = GraphQL `$app:analytics`.
- Write metafields with `metafieldsSet` or inline `metafields:` on owner mutations (`productUpdate` etc.). There are no `metafieldCreate`/`metafieldUpdate`/`metafieldDelete` mutations; delete via `metafieldsDelete(metafields: [{ownerId, namespace, key}])`.
- Metafield `value` is always a String in mutations (JSON-encode complex types). Read with `jsonValue` (Admin, Functions); Storefront exposes `value`/`references`.
- `metaobjectUpsert` (2026-07) takes `handle` plus EITHER `metaobject: MetaobjectUpsertInput` (partial: only given fields change) OR `values: JSON` (full replacement — omitted keys cleared). ≤2026-04: only `metaobject`.
- Access — TOML: `access.admin = "merchant_read"` (default) | `"merchant_read_write"`; `access.storefront = "none"` (default) | `"public_read"`; `access.customer_account = "none"|"read"|"read_write"`. GraphQL: `admin: MERCHANT_READ|MERCHANT_READ_WRITE`, `storefront: NONE|PUBLIC_READ`, `customerAccount: NONE|READ|READ_WRITE`.
- Immutable after definition creation: `type`, `namespace`/`key`, `ownerType`. Updatable: name, description, access, validations (tightening fails if existing values violate).
- TOML-declared definitions are read-only via Admin API mutations — change them only by editing TOML and redeploying.

## Ownership
| Model | Identifier | Created via | Notes |
| - | - | - | - |
| App-owned | ns/type `$app` (`app` in TOML) | TOML (preferred) or GraphQL | App controls schema; merchants edit values if `merchant_read_write` |
| Merchant-owned | any non-reserved ns/type, e.g. `custom` | GraphQL only | Merchants + all apps read/write |
| Standard (Shopify) | e.g. `descriptors.subtitle`, `facts.isbn` | `standardMetafieldDefinitionEnable` or TOML `standard_metafields` | Interoperable; auto-enable on first value write |
| App-data | owner `AppInstallation` (id via `currentAppInstallation`) | `metafieldsSet` only | Hidden from admin; any namespace; not for secrets |

## Surface map (Admin GraphQL)
Mutations: `metafieldsSet`, `metafieldsDelete`, `metafieldDefinitionCreate|Update|Delete(deleteAllAssociatedMetafields:)`, `standardMetafieldDefinitionEnable`, `metaobjectCreate`, `metaobjectUpsert`, `metaobjectUpdate`, `metaobjectDelete`, `metaobjectDefinitionCreate|Update|Delete`.
Queries: `metafieldDefinitions(ownerType:, namespace:, key:, query:)`, `metafieldDefinitionTypes` (validations per type), `standardMetafieldDefinitionTemplates`, `metaobjects(type:, first:)`, `metaobjectByHandle`, `metaobjectDefinitionByType`, `currentAppInstallation`; on any owner: `metafield(key:)`, `metafields(first:)`.
Search by metafield (needs `adminFilterable` on the definition): `products(query: "metafields.custom.color:\"blue\"")`, ranges `metafields.$app.weight:>=1kg`.
Storefront API: `product.metafield(namespace:, key:)`, `metaobject(handle: {type:, handle:})`, `metaobjects(type:, first:)` — need `access.storefront = "public_read"` plus `unauthenticated_read_metaobjects` scope. Liquid reads metafields regardless of storefront access: `product.metafields.custom.color.value`, `metaobjects.author['jane'].bio.value` (global, not `shop.metaobjects`).

## shopify.app.toml definitions
```toml
[product.metafields.app.care_guide]
name = "Care Guide"
type = "single_line_text_field"
access.admin = "merchant_read_write"
access.storefront = "public_read"
validations.max = "120"
capabilities.admin_filterable = true

[product.metafields]
standard_metafields = ["descriptors.subtitle", "facts.isbn"]

[metaobjects.app.author]
name = "Author"
display_name_field = "name"
access.storefront = "public_read"
capabilities.publishable = true

[metaobjects.app.author.fields.name]
name = "Author Name"
type = "single_line_text_field"
required = true

[product.metafields.app.author]
name = "Book Author"
type = "metaobject_reference<$app:author>"
```
Owner segment = any `MetafieldOwnerType`: `product`, `product_variant`, `customer`, `order`, `collection`, `company`, `company_location`, `market`, `page`, `shop`, `discount`, `carttransform`, ….

## Operations (validated against 2026-04)
Write values (definition must already exist; `type` only required without one):
```graphql
mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key jsonValue }
    userErrors { field message code }
  }
}
```
```json
{"metafields": [{"ownerId": "gid://shopify/Product/1234567890", "key": "care_guide", "value": "Machine wash cold"}]}
```
Upsert metaobject (creates or updates by type+handle):
```graphql
mutation UpsertAuthor($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
    metaobject { id handle displayName }
    userErrors { field message code }
  }
}
```
```json
{"handle": {"type": "$app:author", "handle": "jane-smith"}, "metaobject": {"fields": [{"key": "name", "value": "Jane Smith"}]}}
```
Read (alias metafield lookups; resolve references via `reference`/`references`):
```graphql
query ReadCustomData {
  product(id: "gid://shopify/Product/1234567890") {
    careGuide: metafield(key: "care_guide") { jsonValue }
    author: metafield(key: "author") {
      reference { ... on Metaobject { handle fields { key jsonValue } } }
    }
  }
  metaobjects(type: "$app:author", first: 50) {
    nodes { id handle displayName fields { key jsonValue } }
    pageInfo { hasNextPage endCursor }
  }
}
```
Storefront read (`--api storefront-graphql`):
```graphql
query StorefrontCustomData {
  product(handle: "wireless-headphones") {
    careGuide: metafield(namespace: "care", key: "guide") { value }
  }
  metaobjects(type: "author", first: 20) {
    nodes { handle bio: field(key: "bio") { value } }
  }
}
```

## Functions & extensions
Functions input query (validate with `shopify validate functions --api functions_discount` etc.); only `$app`-prefixed metaobjects work; cost: `metaobject` root 1pt, each `field(key:)` 3pt, budget 30:
```graphql
query Input {
  cart {
    lines {
      merchandise {
        __typename
        ... on ProductVariant {
          tierConfig: metafield(namespace: "$app", key: "tier_config") { jsonValue }
        }
      }
    }
  }
}
```
Checkout UI extensions: register in `shopify.extension.toml` — `[[extensions.metafields]]` with `namespace`/`key` (app-owned: `namespace = "$app:my-ns"`) — then read via `useAppMetafields()`, no network call. Resources: `cart`, `company`, `companyLocation`, `customer`, `product`, `shop`, `shopUser`, `variant`.

## Types
Core: `single_line_text_field`, `multi_line_text_field`, `rich_text_field`, `number_integer`, `number_decimal`, `boolean`, `date`, `date_time`, `json`, `money`, `url`, `color`, `link`, `id`, `language`, `rating` (`min`/`max` validations required), unit types (`weight`, `dimension`, `volume`, `duration`, …: `{"value":10,"unit":"grams"}`).
References: `product_reference`, `variant_reference`, `collection_reference`, `customer_reference`, `company_reference`, `order_reference`, `page_reference`, `article_reference`, `file_reference`, `metaobject_reference`, `mixed_reference`, `product_taxonomy_value_reference`. Most types have `list.<type>` variants.
TOML shorthand replaces `metaobject_definition_id(s)` validations: `metaobject_reference<$app:author>`, `mixed_reference<$app:author, $app:publisher>`, `list.metaobject_reference<$app:author>`.

## Limits & gotchas
- `metafieldsSet`: ≤25 metafields/call, 10MB. Definition key 2–64 chars; namespace 3–255.
- TOML limits: ≤128 metafield definitions per owner type; ≤32 metaobject definitions, ≤64 fields each; ≤25 definition changes per deploy (split larger migrations).
- Scopes: owner-type scope (`write_products`, etc.); metaobjects: `read_metaobjects`/`write_metaobjects`; definition mutations: `write_metaobject_definitions`.
- Metaobject handles are unique per type only — lookups by handle always require `type`.
- TOML capabilities — metafields: `admin_filterable`, `unique_values`, `cart_to_order_copyable` (order defs only); not smart-collection/pinning. Metaobjects: `publishable`, `translatable`, `renderable`; not `online_store`.
- Common errors: `TAKEN` (namespace/key in use), invalid type name, unsupported validation for type (check `metafieldDefinitionTypes.supportedValidations`), "no permission to modify" (not app-owned, or TOML-declared).
- Metafield search silently returns unfiltered results if `adminFilterable` isn't enabled.
- `access.storefront` gates only the Storefront API, never Liquid.

## Docs
https://shopify.dev/docs/apps/build/metafields
https://shopify.dev/docs/apps/build/metafields/definitions
https://shopify.dev/docs/apps/build/metafields/list-of-data-types
https://shopify.dev/docs/apps/build/metaobjects
https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet
https://shopify.dev/docs/apps/build/functions/input-queries/metafields-for-input-queries
https://shopify.dev/docs/apps/build/checkout/metafields
