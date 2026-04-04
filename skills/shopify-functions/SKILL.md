---
name: shopify-functions
description: "Guidance for building Shopify Functions — Wasm-compiled backend extensions that customize checkout logic"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Functions

## Mental Model

Functions are **NOT server code**. They are declarative Wasm modules that Shopify invokes at specific points during checkout. You never host them, never expose endpoints, never call them by URL.

**The loop:**
1. You write `run.graphql` (or `input.graphql`) to declare what data you need
2. Shopify calls your function with that data as JSON input
3. Your code returns JSON operations describing what Shopify should do
4. Shopify applies those operations

Functions compile to WebAssembly. Shopify executes them in a sandbox with strict memory/time limits. There is no network access, no filesystem, no environment variables at runtime.

## Execution Order at Checkout

Functions run in this fixed sequence — output of earlier stages feeds later ones:

```
1. Cart Transform          → modify/merge/expand cart lines
2. Discounts (cart lines)  → apply product/order discounts
3. Fulfillment Constraints → group items for fulfillment
4. Order Routing           → prioritize fulfillment locations
5. Delivery Customization  → rename/reorder/hide delivery options
6. Discounts (delivery)    → apply shipping discounts
7. Payment Customization   → rename/reorder/hide payment methods
8. Cart/Checkout Validation → block checkout with error messages
```

This matters: a Cart Transform that merges lines runs BEFORE discounts see those lines.

## Function Types — Decision Tree

| I want to... | Function type | API identifier |
|---|---|---|
| Bundle products or merge cart lines | Cart Transform | `cart_transform` |
| Create a custom discount type | Discounts | `order_discounts`, `product_discounts`, `shipping_discounts` |
| Control which fulfillment locations are used | Order Routing | `order_routing_location_rule` |
| Restrict how items can ship together | Fulfillment Constraints | `fulfillment_constraints` |
| Hide/rename/reorder delivery options | Delivery Customization | `delivery_customization` |
| Hide/rename/reorder payment methods | Payment Customization | `payment_customization` |
| Block checkout with validation errors | Validation | `cart_checkout_validation` |
| Generate pickup point options | Pickup Points | `pickup_point_delivery_option_generator` |
| Generate local pickup options | Local Pickup | `local_pickup_delivery_option_generator` |

## Key Gotchas

**This looks like X but is actually Y:**

- **"I'll use env vars for config"** — Wrong. Functions have no env var access at runtime. Use **metafields** on the function owner (discount, customization, etc.) and query them in `run.graphql`. The merchant configures values through your app's UI.
- **"I'll write it in JS, it's simpler"** — JS works but compiles to larger Wasm. Rust is strongly recommended for production, especially with large carts. JS functions may timeout where Rust won't.
- **"I'll call an external API from my function"** — No network access inside functions. If you need external data, use the `fetch` target (pre-run hook) or pre-compute and store in metafields.
- **"run.graphql is just a query"** — It defines the exact shape of your function's input. Change it and your input type changes. Run `shopify app function typegen` after editing.
- **"I can test by deploying"** — Use `shopify app function run` locally with JSON input piped via stdin. Use `shopify app function replay` to re-run against real logged inputs.

## TOML Configuration

Function extensions are configured in the extension's TOML file:

```toml
api_version = "2025-01"
type = "cart_transform"    # the function API type
name = "My Cart Transform"

[build]
command = "cargo wasm"     # or JS build command
path = "dist/index.wasm"
wasm_opt = true            # optimize wasm binary (default: true)

# Optional: input variable configuration for metafield-based config
[input.variables]
namespace = "my-app"
key = "config"
```

The `targeting` array in TOML allows a single Wasm module to serve multiple targets with different input queries and exports.

## CLI Commands

All under `shopify app function`:

| Command | Purpose |
|---|---|
| `build` | Compile function to Wasm |
| `run` | Run locally with JSON input (stdin or `--input`) |
| `replay` | Re-run against a real logged input from `app dev` |
| `schema` | Fetch latest GraphQL schema for the function's API type |
| `typegen` | Generate types from your `run.graphql` / `input.graphql` |
| `info` | Print function metadata (handle, API version, paths) |

Typical workflow: `schema` -> edit `run.graphql` -> `typegen` -> code -> `build` -> `run`

## Documentation

- [Functions overview](https://shopify.dev/docs/apps/build/functions)
- [Function APIs reference](https://shopify.dev/docs/api/functions)
- [Input/output patterns](https://shopify.dev/docs/apps/functions/input-output)
- [Testing and debugging](https://shopify.dev/docs/apps/functions/testing-and-debugging)
- [Error handling](https://shopify.dev/docs/api/functions/errors)
- [Language support (Rust vs JS)](https://shopify.dev/docs/apps/functions/language-support)

## Source Reference

- CLI commands: `packages/app/src/cli/commands/app/function/`
- Function spec: `packages/app/src/cli/models/extensions/specifications/function.ts`
- Function services: `packages/app/src/cli/services/function/`
