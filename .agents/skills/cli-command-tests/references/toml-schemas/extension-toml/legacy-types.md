# Historical extension types and aliases

These types appear in CLI or template history but are no longer generated. Each linked file records the latest shape that the sources can reconstruct and its intended migration target.

| Historical type                        | File                                                                                             | Canonical destination                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `checkout_ui_extension`                | [checkout-ui-extension-legacy.md](checkout-ui-extension-legacy.md)                               | `ui_extension`                                              |
| `customer_accounts_ui_extension`       | [customer-accounts-ui-extension-legacy.md](customer-accounts-ui-extension-legacy.md)             | `ui_extension`                                              |
| `pos_ui_extension`                     | [pos-ui-extension-legacy.md](pos-ui-extension-legacy.md)                                         | `ui_extension`                                              |
| `product_subscription`                 | [product-subscription-legacy.md](product-subscription-legacy.md)                                 | target-driven `ui_extension` / product-specific replacement |
| `subscription_management`              | [subscription-management-legacy.md](subscription-management-legacy.md)                           | resolve UI behavior before migration                        |
| `product_configuration_link_extension` | [product-configuration-link-extension-legacy.md](product-configuration-link-extension-legacy.md) | current product configuration/admin link model              |
| `marketing_activity`                   | [marketing-activity-legacy.md](marketing-activity-legacy.md)                                     | migrated app module / Flow action model                     |
| `marketing_activity_extension`         | [marketing-activity-extension-legacy.md](marketing-activity-extension-legacy.md)                 | `marketing_activity`                                        |
| `channel_specification`                | [channel-specification-legacy.md](channel-specification-legacy.md)                               | `channel_config`                                            |
| `data_extension`                       | [data-extension-legacy.md](data-extension-legacy.md)                                             | `ui_extension` `should_render` module                       |
| `product_feed_query`                   | [product-feed-query-legacy.md](product-feed-query-legacy.md)                                     | remote migration only                                       |
| `product_sync_query`                   | [product-sync-query-legacy.md](product-sync-query-legacy.md)                                     | remote migration only                                       |

Old generated filenames such as `shopify.ui.extension.toml` and `shopify.theme.extension.toml` are envelope and filename versions, not extension types.

The CLI also recognizes historical Function API identifiers. [Function schema history](function.md) covers them because they share the Function field schema.
