# Storefront GraphQL API
Buyer-facing GraphQL API for custom storefronts: product/collection browse, search, cart, checkout handoff, classic customer accounts, localization. GraphQL only — there is no REST Storefront API.

## Version, endpoint, validation
- Latest stable `2026-07`; releases quarterly (`YYYY-01|04|07|10`). Single endpoint, POST only: `https://{store}.myshopify.com/api/{version}/graphql.json`.
- Prove operations locally (offline, no login): `shopify validate graphql --api storefront-graphql --file q.graphql [--version 2026-07]`. Output names the schema version used.

## Corrections to stale training data
- Checkout APIs are GONE (shut off 2025-04-01): every `checkout*` mutation (`checkoutCreate`, `checkoutCompleteWithCreditCardV2`, `checkoutLineItemsAdd`, and the rest) and the `Checkout` object no longer exist. Build with the Cart API, then redirect to `cart.checkoutUrl` for Shopify web checkout.
- `metafieldStorefrontVisibilityCreate` removed in 2025-01. Expose metafields via Admin API `metafieldDefinitionCreate`/`metafieldDefinitionUpdate` with `access: {storefront: "PUBLIC_READ"}`; unexposed metafields return `null` here.
- Cart `cost.totalTaxAmount` / `cost.totalDutyAmount` deprecated 2025-01 — tax/duties are finalized only at checkout.
- Removed since 2022-04: `Shop.products`, `Shop.productByHandle`, `Shop.collections`, `Shop.collectionByHandle`, `Shop.currencyCode`, `ProductVariant.available` (use `availableForSale`), and image args `maxWidth/maxHeight/scale/crop` (use `Image.url(transform: {maxWidth: 800})`).
- Tokenless access exists: products, collections, search, pages/blogs/articles, selling plans, and full cart read/write work with NO token, capped at query complexity 1,000 (`MAX_COMPLEXITY_EXCEEDED`).
- Customer Account API (separate OAuth API at shopify.dev/docs/api/customer) is the recommended customer-data path since Jan 2024. Classic `customerAccessTokenCreate` still works for legacy accounts. `storefrontCustomerAccessTokenCreate` is deprecated (2025-01): pass Customer Account API tokens directly via `@inContext(buyer: {customerAccessToken: "..."})` or `buyerIdentity.customerAccessToken`.
- No request-per-minute rate limit for real buyer traffic; bot/automated traffic is throttled and suspect requests get HTTP `430 Shopify Security Rejection`.

## Auth
| Mode | Header | Context |
|---|---|---|
| Tokenless | none | Browse/search/cart, complexity ≤ 1,000 |
| Public token | `X-Shopify-Storefront-Access-Token` | Browser/mobile safe |
| Private token | `Shopify-Storefront-Private-Token` | Server only; secret |
- Server-side requests must also send `Shopify-Storefront-Buyer-IP` (case-sensitive) with the end buyer's IP, else throttling, weak bot protection, and logged-out checkout.
- Get tokens from the Headless channel (creates public + private pairs) or a custom app (Admin `storefrontAccessTokenCreate`; grant `unauthenticated_*` scopes, e.g. `unauthenticated_read_product_listings`, `unauthenticated_read_customers`).
- Token required for: `Product.tags`, metafields/metaobjects, `menu`, customer operations.

## Directives
- `@inContext(country: CA)` — market pricing/availability; `@inContext(language: FR)` — translated content; combine both.
- `@inContext(buyer: {customerAccessToken, companyLocationId})` (2024-04+) — B2B/personalized context; ignored for carts (set cart `buyerIdentity`).
- `@inContext(visitorConsent: {analytics, marketing, preferences, saleOfData})` (2025-10+) — consent encoded into `checkoutUrl`.
- `@defer` — `unstable` only; not in stable releases.

## Core surface
Queries: `products` `product(handle|id)` `collection(handle|id)` `collections` `search` `predictiveSearch` `cart(id)` `customer(customerAccessToken)` (orders via `customer.orders`) `shop` `localization` `menu(handle)` `productRecommendations(productHandle|productId, intent: RELATED|COMPLEMENTARY)` `metaobject(s)` `blog(s)` `article(s)` `page(s)` `sellingPlanGroups` via product.
Cart mutations: `cartCreate` `cartLinesAdd` `cartLinesUpdate` `cartLinesRemove` `cartBuyerIdentityUpdate` `cartAttributesUpdate` `cartNoteUpdate` `cartDiscountCodesUpdate` `cartGiftCardCodesAdd|Update|Remove` `cartSelectedDeliveryOptionsUpdate` `cartDeliveryAddressesAdd|Update|Remove|Replace` `cartMetafieldsSet` `cartMetafieldDelete`.
Classic customer mutations: `customerCreate` `customerAccessTokenCreate` `customerAccessTokenCreateWithMultipass` `customerAccessTokenRenew` `customerAccessTokenDelete` `customerActivate(ByUrl)` `customerRecover` `customerReset(ByUrl)` `customerUpdate` `customerAddressCreate|Update|Delete` `customerDefaultAddressUpdate`.
Shop Pay wallet: `shopPayPaymentRequestSessionCreate` `shopPayPaymentRequestSessionSubmit`.

## Cart essentials
- Cart ID format: `gid://shopify/Cart/<token>?key=<secret>`. Always pass the FULL id including `?key=`; without it reads strip buyer PII and mutations fail with "cart does not exist". Never put the key in shareable URLs or client-visible code.
- `CartLineInput`: `merchandiseId` (ProductVariant GID), `quantity`, `attributes`, `sellingPlanId` (subscriptions).
- `lines.merchandise` is the `Merchandise` union — select via `... on ProductVariant`.
- Read `userErrors {field message code}` and `warnings {code message}` on every cart mutation; business failures land there, not in top-level `errors`.
- Fetch `checkoutUrl` fresh at click time; buyer arrives logged in when `buyerIdentity.customerAccessToken` is set.

## Search & filtering
- `products(query: "...")` syntax: `available_for_sale:true`, `product_type:snowboard`, `tag:sale`, `tag_not:clearance`, `title:hoodie`, `variants.price:>=10`, `created_at:>'2020-10-21T23:39:20Z'`; combine with `AND`/`OR`. `sortKey: ProductSortKeys` (`TITLE PRICE BEST_SELLING CREATED_AT UPDATED_AT ID RELEVANCE VENDOR PRODUCT_TYPE`).
- `search`: `types: [PRODUCT, PAGE, ARTICLE]`, `productFilters`, `unavailableProducts: SHOW|HIDE|LAST`, `prefix: LAST` (partial last word), `sortKey: RELEVANCE|PRICE`; returns `totalCount` and facet metadata `productFilters {id label values {id label count input}}`.
- `predictiveSearch`: `limit` 1–10 (default 10), `limitScope: ALL|EACH`, `types` adds `COLLECTION` and `QUERY` (suggestions); result is not a connection (no pagination).
- `ProductFilter` fields: `available`, `price {min max}`, `productType`, `productVendor`, `variantOption {name value}`, `tag`, `category {id}`, `productMetafield`, `variantMetafield`, `taxonomyMetafield {namespace key value}`. Same input filters `collection.products(filters:)`; non-default filters must be enabled in the Search & Discovery app.

## Limits & gotchas
- Connection `first`/`last` ≤ 250; input arrays ≤ 250 items; cursor pagination capped at 25,000 objects (counts report 25,001 meaning "more").
- Use `nodes` instead of `edges {node}` when cursors aren't needed; page with `pageInfo {hasNextPage endCursor}` + `after`.
- Errors usually return HTTP 200 with `errors[].extensions.code`: `THROTTLED`, `ACCESS_DENIED`, `SHOP_INACTIVE`, `MAX_COMPLEXITY_EXCEEDED`, `INTERNAL_SERVER_ERROR`.
- All ids are GIDs (`gid://shopify/ProductVariant/42`); bare integers fail. Prefer `handle` args for storefront routing.
- Money is `MoneyV2 {amount currencyCode}`; `amount` is a decimal string.
- Metafields: `metafield(namespace: "custom", key: "care_guide")`; batch `metafields(identifiers: [{namespace: "custom", key: "care_guide"}])` returns a positional list with nullable entries.
- Variant pickers: `variantBySelectedOptions(selectedOptions: [{name, value}])`, `selectedOrFirstAvailableVariant`, `adjacentVariants`.

## Examples (all pass `shopify validate graphql --api storefront-graphql`)
```graphql
query ProductsWithVariants($first: Int!, $after: String) @inContext(country: CA, language: FR) {
  products(first: $first, after: $after, sortKey: BEST_SELLING) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title
      featuredImage { url altText }
      priceRange { minVariantPrice { amount currencyCode } }
      variants(first: 10) { nodes { id title availableForSale price { amount currencyCode } selectedOptions { name value } } }
    }
  }
}
```
```graphql
mutation CartCreate($lines: [CartLineInput!]!, $buyer: CartBuyerIdentityInput) {
  cartCreate(input: {lines: $lines, buyerIdentity: $buyer}) {
    cart {
      id checkoutUrl totalQuantity
      cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
      lines(first: 50) { nodes { id quantity merchandise { ... on ProductVariant { id title product { title handle } } } } }
    }
    userErrors { field message code }
    warnings { code message }
  }
}
```
```graphql
mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) {
    cart { id totalQuantity cost { totalAmount { amount currencyCode } } }
    userErrors { field message code }
  }
}
```
```graphql
query SearchProducts($query: String!, $first: Int!) {
  search(query: $query, first: $first, types: [PRODUCT], productFilters: [{available: true}, {price: {min: 10.0, max: 200.0}}]) {
    totalCount
    pageInfo { hasNextPage endCursor }
    productFilters { id label values { id label count input } }
    nodes { ... on Product { id title handle priceRange { minVariantPrice { amount currencyCode } } } }
  }
}
```

## Docs
https://shopify.dev/docs/api/storefront/latest
https://shopify.dev/docs/api/usage/authentication
https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started
https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage
https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/filter-products
https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/metafields
https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/customer-accounts
https://shopify.dev/docs/api/usage/limits
