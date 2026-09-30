# Legacy `customer_accounts_ui_extension`

```text
LegacyCustomerAccountsUI := Base & {
  name: string
  type: "customer_accounts_ui_extension"
  extension_points: Array<string | object>
  capabilities?: Capabilities
  metafields?: Array<{namespace: string, key: string}>
  settings?: Settings
  authenticated_urls?: string[]
}
```

## Versions and migration

- **CA0 (2022-11-28):** added `authenticated_urls` to the customer-accounts-specific schema.
- **CA1 (2023-08):** extension template existed under customer-account/customer-accounts directory names.
- **CA2 (2023-10-26):** CLI removed the legacy local code. New projects use `type = "ui_extension"` and `targeting`.

Preserve target objects, capabilities, metafields, and settings. `authenticated_urls` has no matching field in the current local `ui_extension` schema. Confirm whether it maps to a modern capability or is obsolete; never drop it silently.
