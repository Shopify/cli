# Legacy `subscription_management`

The local product-subscription compatibility specification accepts `subscription_management` as its GraphQL and remote alias.

```text
LegacySubscriptionManagement := Base & {
  type: "subscription_management"
}
```

The type adds no local TOML fields beyond the [product subscription schema](product-subscription-legacy.md). It built one Admin UI bundle and deployed its renderer version.

Do not automatically migrate this type to `subscription_link_extension`. A management UI and a “View subscription” link serve different purposes. Resolve the modern target before applying `up`.
