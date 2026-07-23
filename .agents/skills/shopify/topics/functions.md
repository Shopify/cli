# Shopify Functions
Wasm extensions customizing Shopify backend logic: discounts, cart transforms, validation, delivery/payment customization, order routing, fulfillment constraints, pickup options.

## Corrections to stale training data
- Latest stable API version: **2026-04** (quarterly; `unstable` exists). After changing `api_version` in `shopify.extension.toml`, run `shopify app function schema`.
- The unified **Discount Function API** (kind `functions_discount`) replaces the deprecated Order/Product/Shipping Discount APIs (`purchase.order-discount.run` etc.; kinds `functions_order_discounts|product_discounts|shipping_discounts` — use only on explicit request). One function serves all `DiscountClass` values (`PRODUCT|ORDER|SHIPPING`), read from `discount.discountClasses`.
- Cart Transform operations are `lineExpand`, `linesMerge` (plural), `lineUpdate` — old `expand`/`merge`/`update` names are gone.
- Validation output is `{"operations":[{"validationAdd":{"errors":[{"message","target"}]}}]}` — not a bare `errors` array.
- Discounts Allocator (`functions_discounts_allocator`) and Local Pickup / Pickup Point Generators are `unstable`-only (validator falls back).
- Functions are pure and deterministic: no network (except fetch targets), clock, randomness, filesystem, or STDOUT debugging. Logs truncate at 1 kB.
- Rust is recommended (fastest). JS compiles via Javy (ES2020) with **no event loop — `async`/`await`/promises throw at runtime**; use `@shopify/shopify_function` v2+. Any Wasm language works.
- Fetch targets (network access): custom apps on Plus/Enterprise only, approved network-access request required; Shopify makes the HTTP call and feeds the cached response to `run` via `fetchResult`.
- Max 25 active discount functions per store; apps can only reference their own functions in Admin mutations (e.g. `discountAutomaticAppCreate`, `cartTransformCreate`) — else `Function not found`.

## Surface map
Result type = PascalCase target + `Result`; export/fn = snake_case target (Rust) or camelCase (JS).
| Validator kind | Target | Operations |
|---|---|---|
| `functions_discount` | `cart.lines.discounts.generate.run` | `productDiscountsAdd`, `orderDiscountsAdd`, `enteredDiscountCodesAccept`, `enteredDiscountCodesReject` |
| " (shipping leg) | `cart.delivery-options.discounts.generate.run` | `deliveryDiscountsAdd`, `enteredDiscountCodesAccept/Reject` |
| " (optional fetch) | `cart.lines.discounts.generate.fetch`, `cart.delivery-options.discounts.generate.fetch` | HTTP request |
| `functions_cart_transform` | `cart.transform.run` | `lineExpand`, `linesMerge`, `lineUpdate` (update = Plus-only) |
| `functions_cart_checkout_validation` | `cart.validations.generate.run` | `validationAdd{errors{message,target}}` |
| `functions_delivery_customization` | `cart.delivery-options.transform.run` | `deliveryOptionHide/Move/Rename` (by `deliveryOptionHandle`) |
| `functions_payment_customization` | `cart.payment-methods.transform.run` | `paymentMethodHide/Move/Rename`, `paymentTermsSet`, `orderReviewAdd` (B2B) |
| `functions_fulfillment_constraints` | `cart.fulfillment-constraints.generate.run` | `deliverableLinesMustFulfillFromAdd`, `deliverableLinesMustFulfillFromSameLocationAdd` |
| `functions_order_routing_location_rule` | `cart.fulfillment-groups.location-rankings.generate.run` | `fulfillmentGroupLocationRankingAdd{fulfillmentGroupHandle,rankings{locationHandle,rank}}` |
| `functions_local_pickup_delivery_option_generator` (unstable) | `purchase.local-pickup-delivery-option-generator.run` → `FunctionRunResult` | `add: LocalPickupDeliveryOption` |
| `functions_pickup_point_delivery_option_generator` (unstable) | `purchase.pickup-point-delivery-option-generator.run`/`.fetch` → `FunctionRunResult`/`FunctionFetchResult` | `add: {pickupPoint}` |

Discount enums: `OrderDiscountSelectionStrategy FIRST|MAXIMUM`; `ProductDiscountSelectionStrategy FIRST|MAXIMUM|ALL`; `DeliveryDiscountSelectionStrategy ALL`. Candidate values: `percentage{value}` or `fixedAmount{amount}` (product fixedAmount adds `appliesToEachItem`). Candidate targets: `orderSubtotal{excludedCartLineIds}`, `cartLine{id,quantity}`, `deliveryOption{handle}`, `deliveryGroup{id}`. Order candidates only take `conditions`: `orderMinimumSubtotal`, `cartLineMinimumSubtotal`, `cartLineMinimumQuantity`.

Input roots (only these exist): all kinds have `cart`, `shop`, `localization`, `presentmentCurrencyRate`, plus — discount: `discount{discountClasses,metafield}`, `enteredDiscountCodes`, `triggeringDiscountCode`, `fetchResult`; cart_transform: `cartTransform`; validation: `validation`, `buyerJourney`, `fetchResult`; delivery: `deliveryCustomization`; payment: `paymentCustomization`, `paymentMethods`; fulfillment: `fulfillmentConstraintRule`, `locations`; routing: `fulfillmentGroups`, `locationRule`, `locations`.

## Workflow
```bash
shopify app generate extension --template discount --flavor rust --name my-discount
shopify app function build     # compile Wasm (run in function dir)
shopify app function run --input input.json --export cart_lines_discounts_generate_run
shopify app function schema    # refresh schema.graphql after api_version change
shopify app function typegen   # JS/TS: regenerate types from input query
shopify validate functions --api functions_discount --file src/cart_lines_discounts_generate_run.graphql
```
`--template` = API in snake_case (e.g. `discount`, `cart_transform`, `cart_checkout_validation`); flavors `rust|vanilla-js|typescript|wasm`. Never run `shopify app deploy` unasked.

## Input query rules
- One query per target; file named after the target (`src/cart_lines_discounts_generate_run.graphql`), never `input.graphql`; Rust operation name must be `Input`.
- Union selections need `__typename` on the parent (`merchandise { __typename ... on ProductVariant { id } }`).
- No direct `tags` field: use `hasAnyTag(tags:)` → Boolean or `hasTags(tags:)` → `[{hasTag,tag}]`; collections via `inAnyCollection(ids:)`/`inCollections(ids:)`. Each costs 3; max query cost 30, max 3000 bytes, list args ≤100 items, metafield values >10 kB return null.
- Function-owner metafield holds config: `metafield(namespace: "$app:handle", key: "config") { jsonValue }` (reserved `$app` prefix). Merchant-set values via `[extensions.input.variables]` feed query variables.

## Examples (validated on 2026-04)
`functions_discount`, `cart.lines.discounts.generate.run`:
```graphql
query Input($tags: [String!]) {
  discount {
    discountClasses
    metafield(namespace: "$app:my-discount", key: "config") { jsonValue }
  }
  cart {
    lines {
      id
      quantity
      cost { subtotalAmount { amount } }
      merchandise {
        __typename
        ... on ProductVariant { id product { hasAnyTag(tags: $tags) } }
      }
    }
  }
}
```
Matching minimal result JSON:
```json
{"operations":[{"orderDiscountsAdd":{"selectionStrategy":"FIRST","candidates":[{"targets":[{"orderSubtotal":{"excludedCartLineIds":[]}}],"value":{"percentage":{"value":"10.0"}}}]}}]}
```
`functions_cart_transform`, `cart.transform.run`:
```graphql
query Input {
  presentmentCurrencyRate
  cart {
    lines {
      id
      quantity
      cost { amountPerQuantity { amount currencyCode } }
      giftWrap: attribute(key: "gift-wrap") { value }
      merchandise { __typename ... on ProductVariant { id } }
    }
  }
}
```
`functions_cart_checkout_validation`, `cart.validations.generate.run`:
```graphql
query Input {
  cart { deliveryGroups { deliveryAddress { address1 countryCode } } }
  validation { metafield(namespace: "$app:validation", key: "config") { jsonValue } }
}
```

## shopify.extension.toml
```toml
api_version = "2026-04"

[[extensions]]
name = "t:name"
handle = "my-discount-function"
type = "function"

  [[extensions.targeting]]
  target = "cart.lines.discounts.generate.run"
  input_query = "src/cart_lines_discounts_generate_run.graphql"
  export = "cart_lines_discounts_generate_run"

  [extensions.build]
  command = "cargo build --target=wasm32-unknown-unknown --release"
  path = "target/wasm32-unknown-unknown/release/discount.wasm"
```
JS omits `build.command`; `path` defaults to `dist/index.wasm`, `export` to `_start`. Merchant config UI: `[extensions.ui] handle`/`enable_create` or `[extensions.ui.paths] create`/`details` (mutually exclusive).

## Rust specifics
Import only `shopify_function` (never `serde`/`chrono`). Target files start `use crate::schema; use shopify_function::prelude::*; use shopify_function::Result;`; the fn is annotated `#[shopify_function]` and named after the target. `src/main.rs` declares `#[typegen("./schema.graphql")] pub mod schema { #[query("src/cart_lines_discounts_generate_run.graphql")] pub mod cart_lines_discounts_generate_run {} }` — one query module per target, named after it. Struct paths mirror query nesting (`schema::cart_lines_discounts_generate_run::input::cart::lines::Merchandise::ProductVariant`). Optional fields are `Option` — unwrap them; `Decimal(10.0)` from floats only; match arms need `_` wildcard.

## Limits & gotchas
Binary ≤256 kB; linear memory 10 MB; stack 512 kB; ≤11 M instructions, 128 kB input, 20 kB output at ≤200 lines (scales above). Custom apps with functions require Plus. Functions run concurrently, unaware of each other; discount stacking follows the discount node's combinesWith rules. `enteredDiscountCodesReject` only works for automatic-discount-backed functions. Delivery reorder must keep the cheapest shipping option first (App Store rule). `lineUpdate` images show in checkout only. Draft orders don't support discount functions with network access.

## Docs
https://shopify.dev/docs/api/functions/latest
https://shopify.dev/docs/api/functions/latest/discount
https://shopify.dev/docs/apps/build/functions/programming-languages/rust-for-functions
https://shopify.dev/docs/apps/build/functions/input-queries/metafields-for-input-queries
https://shopify.dev/docs/apps/build/functions/network-access/use-network-access
