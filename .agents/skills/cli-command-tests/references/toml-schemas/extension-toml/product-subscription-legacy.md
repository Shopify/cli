# Legacy `product_subscription` and `subscription_management`

The local compatibility specification accepts only the common Base:

```text
LegacyProductSubscription := Base & {
  type: "product_subscription" | "subscription_management"
}
```

It builds one UI entry bundle with `@shopify/admin-ui-extensions`. `subscription_management` is the GraphQL and remote alias.

## Versions and migration

- **PS0:** standalone `shopify.ui.extension.toml` with product-subscription type.
- **PS1:** `subscription_management` accepted as an additional identifier.
- **PS2:** current subscription-link configuration is a separate `subscription_link_extension`, not a drop-in schema rename.

Behavior determines the modern target. Migrate merchant UI to an appropriate `ui_extension` target. Use `subscription_link_extension` for “View subscription” links. Do not map every instance to the link type.

## Sources

- `product_subscription.ts`
- historical `product-subscription` template history
