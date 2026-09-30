# `function`

Every Shopify Function template and language shares this schema. Function API and target changes affect values, not the TOML structure.

## Current full locally visible schema

```text
Function := Base & {
  name: string
  type: string                 # current templates use "function";
                               # legacy API-specific types remain accepted
  handle?: Handle
  uid?: UID
  description?: string
  api_version: string

  build?: {
    command?: string           # blank string normalizes to undefined
    path?: string
    watch?: string | string[]
    wasm_opt?: boolean = true
    typegen_command?: string   # blank string normalizes to undefined
  }

  configuration_ui?: boolean = true

  ui?: {
    enable_create?: boolean
    paths?: {
      create: string
      details: string
    }
    handle?: string
  }

  input?: {
    variables?: {
      namespace: string
      key: string
    }
  }

  targeting?: Array<{
    target: string
    input_query?: string
    export?: string
  }>
}
```

The current public docs make `ui.handle` and `ui.paths` mutually exclusive. Local Zod does not enforce that rule, but the runtime contract can.

## Structural versions

### F0 — legacy Function config (before 2023-06-09)

Standalone files used API-specific `type` values and one root input query. The CLI required a build config.

```text
{
  name: string
  type: "product_discounts" | "shipping_discounts" | ...
  api_version: string
  build: { command: string, path?: string, watch?: string | string[] }
  configuration_ui?: boolean
  ui?: { enable_create?: boolean, paths?: { create: string, details: string } }
  input?: { variables?: { namespace: string, key: string } }
}
```

### F1 — `[[targets]]` (2023-06-09)

[`2f51fff039`](https://github.com/Shopify/cli/commit/2f51fff039) added multiple target declarations under `[[targets]]`.

Change from F0: each target could select its own input query and Wasm export.

### F2 — `[[targeting]]` rename (2023-06-09)

[`44ed9e2416`](https://github.com/Shopify/cli/commit/44ed9e2416) renamed `targets` to `targeting`. The current schema accepts only `targeting`. Keep an F1 migration fixture because released code used that intermediate shape.

### F3 — unified `[[extensions]]` and handle (2023-07)

Functions adopted the unified envelope and `handle`. `additionalIdentifiers` kept API-specific local identifiers valid, while generated templates settled on `type = "function"`.

### F4 — UI extension handle (2023-09-06)

The CLI added `ui.handle` as an alternative to App Bridge `ui.paths`, allowing a separate UI extension to configure the Function.

### F5 — configurable Wasm optimization (2024-12-10)

The CLI added `build.wasm_opt?: boolean` with a default of `true`.

### F6 — build optional (2025-10-06)

[`a070a07a4d`](https://github.com/Shopify/cli/commit/a070a07a4d) changed `build` from required to optional. JavaScript templates use an empty `command`, which normalizes to `undefined`; default build behavior supplies `dist/index.wasm` where applicable.

### F7 — non-JS type generation (2026-02-19)

The CLI added `build.typegen_command?: string`. Like `command`, a blank string normalizes to `undefined`.

## Identifier history

The local `function` specification also recognizes these historical identifiers:

- `order_discounts`
- `cart_checkout_validation`
- `cart_transform`
- `delivery_customization`
- `payment_customization`
- `product_discounts`
- `shipping_discounts`
- `fulfillment_constraints`
- `order_routing_location_rule`
- `local_pickup_delivery_option_generator`
- `pickup_point_delivery_option_generator`

Treat identifier normalization separately from target normalization: old types can imply a Function API even when no explicit `targeting` exists.

## Template history notes

The template repository consolidated Function templates on 2025-05-15. Current JavaScript, Rust, and Wasm templates differ only in `build.command`, `build.path`, `build.watch`, and Wasm `export` spelling. Quarterly `api_version` and target changes do not create schema versions.

## Cross-source differences

- Public docs say `build.command` is required inside an optional `build` table, except JavaScript. Local Zod makes `command` optional for all languages.
- Public docs say `ui.paths.create/details` are optional; local Zod requires both if `paths` exists.
- Public docs present `type = "function"`; local CLI intentionally accepts historical API-specific types.
- Templates include `path = ""` and `watch = []` for bring-your-own-Wasm scaffolds; these are valid values, not omitted values.

## E2E fixtures

Cover:

- F0 API-specific type
- F1 `targets`
- F2 `targeting`
- F3 unified
- F4 each UI form
- F5 optimization omitted and set to `false`
- F6 no build, blank JavaScript command, and custom Wasm path
- F7 type generation command
- one JavaScript, Rust, and Wasm fixture for single, multiple, and fetch-plus-run targets

## Sources

- `packages/app/src/cli/models/extensions/specifications/function.ts`
- [Function configuration](https://shopify.dev/docs/api/functions/latest#configuration)
- `functions-*` directories in `Shopify/extensions-templates`
