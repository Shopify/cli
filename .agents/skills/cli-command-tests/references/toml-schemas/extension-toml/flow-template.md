# `flow_template`

## Current full locally visible schema

```text
FlowTemplate := Base & {
  name: string
  type: "flow_template"
  handle: Handle
  uid?: UID
  description: string(max 1024)
  template: {
    categories: Category[]
    module: string
    require_app?: boolean
    discoverable?: boolean
    allow_one_click_activate?: boolean
    enabled?: boolean
  }
}

Category :=
  "buyer_experience" | "customers" | "fulfillment" |
  "inventory_and_merch" | "loyalty" | "orders" | "promotion" |
  "risk" | "b2b" | "payment_reminders" | "custom_data" |
  "error_monitoring" | "capture_at_fulfillment"
```

At deployment, the module glob must resolve to a `.flow` workflow file.

## Structural versions

### FTM0 — initial schema (2023-06-09)

The first schema kept template metadata at the top level and allowed one workflow module.

### FTM1 — multiple-template prototype (2023-08-02)

A short-lived schema represented multiple templates per extension.

### FTM2 — `listed` renamed to `discoverable` (2023-08-03)

The public property became `discoverable`. Historical `listed` should migrate directly to it.

### FTM3 — one `[extensions.template]` object (2023-08-16)

The schema returned to one template per extension and moved template-only properties under `[extensions.template]`. Current configs still use this shape.

### FTM4 — bounded description (2023-09-19)

Description gained the 1024-character maximum.

### FTM5 — one-click activation (2023-10-27)

Added `allow_one_click_activate?: boolean`.

### FTM6 — optional publication controls (2023-11-10)

The local schema made `require_app`, `discoverable`, `allow_one_click_activate`, and `enabled` optional. The platform documents their defaults as `false`, `true`, `false`, and `true`; local Zod does not apply those defaults.

### FTM7 — UID (2024-04-14 / template 2024-05-21)

Added common `uid` generation.

### FTM8 — category validation (2024-06-19)

Categories changed from arbitrary strings to the allowlist shown above. Local validation accepts `capture_at_fulfillment` for Flow-team usage, but public docs omit it.

## Cross-source differences

- Public docs say at least one category and recommend at most two; local Zod allows an empty array and has no maximum.
- Public docs list 12 categories; local code also accepts `capture_at_fulfillment`.
- The template explicitly writes default booleans, while local schema keeps them optional.

## E2E fixtures

Cover:

- initial top-level and prototype shapes from release history
- FTM3 canonical nesting
- legacy `listed` and current `discoverable`
- the description length boundary
- every optional boolean, omitted and present
- a valid public category
- the internal category
- an unknown category
- empty and three-category arrays

## Sources

- `packages/app/src/cli/models/extensions/specifications/flow_template.ts`
- [Flow template reference](https://shopify.dev/docs/apps/build/flow/templates/reference)
- `flow-template/shopify.extension.toml.liquid`
