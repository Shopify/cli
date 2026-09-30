# `subscription_link_extension`

A runtime contract validates this type; it has no dedicated local Zod specification. The public schema is:

```text
SubscriptionLink := {
  name: string
  type: "subscription_link_extension"
  uid: UID
  handle: Handle
  pattern: string   # relative path or absolute URI template
}
```

Define the config as an entry in `[[extensions]]`.

## Structural versions

- **SL0 — introduced 2024-10-30:** the template and public docs use the same shape. No later structural template change was found.

Dashboard-created subscription links predate the CLI file. Represent them as import and migration fixtures, not another TOML schema, unless a source export is available.

## E2E fixtures

Cover:

- a relative pattern
- an absolute URI template
- path variables and query expansion
- a malformed template
- a missing handle
- a missing UID
- a duplicate handle

## Sources

- [Build a subscription link extension](https://shopify.dev/docs/apps/build/purchase-options/subscriptions/contracts/subscription-link-extensions/start-building)
- `subscription-link/shopify.extension.toml.liquid`
