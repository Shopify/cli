# `checkout_post_purchase`

## Current full locally visible schema

```text
CheckoutPostPurchase := Base & {
  name?: string
  type?: "checkout_post_purchase"
  handle?: Handle
  uid?: UID
  metafields?: Array<{ namespace: string, key: string }>
}
```

The local specification leaves `name` and `type` optional. The runtime contract tightens them. Deployment sends `metafields ?? []`.

## Structural versions

- **PP0 — standalone legacy (before 2023-07):** usually `shopify.ui.extension.toml`, with `name`, `type`, and optional `[[metafields]]`.
- **PP1 — unified template (2023-07-21):** template used `[[extensions]]`.
- **PP2 — UID (2024-05-21):** generated template gained `uid`.
- **PP3 — current standalone generation:** the template later returned to the minimal standalone envelope. The public docs also show standalone `name`, `handle`, `type`, `uid`, and root `[[metafields]]`.

Each envelope transition creates a format version, even though the type-specific fields stay the same.

## Cross-source differences

Public docs require `name`, `type`, and `uid`, while local Zod inherits optional Base fields so old projects still load. Public docs also limit metafields to five; local Zod does not enforce that limit.

## E2E fixtures

Cover:

- the old filename
- PP0 standalone before handles
- PP1 unified
- configs before and after UID
- PP3 current standalone
- zero, five, and six metafields
- a generated handle omitted and present

## Sources

- `packages/app/src/cli/models/extensions/specifications/checkout_post_purchase.ts`
- [Post-purchase configuration](https://shopify.dev/docs/api/checkout-extensions/post-purchase/configuration)
- `checkout-post-purchase/shopify.extension.toml.liquid`
