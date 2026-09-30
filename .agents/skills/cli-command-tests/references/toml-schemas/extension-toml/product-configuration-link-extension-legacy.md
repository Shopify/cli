# Legacy `product_configuration_link_extension`

The public template used this shape:

```text
ProductConfigurationLink := {
  name: string
  type: "product_configuration_link_extension"
  handle: Handle
  uid?: UID
  pattern: string
}
```

## Versions and migration

- **PCL0 — 2024-11-27:** introduced as `product-configuration-link`.
- **PCL1 — 2024-12-03:** directory/type naming stabilized.
- **PCL2 — 2024-12-11:** pattern changed from a contract-id form to `/bundles{?product_id,shop}`.

Current templates and local specifications no longer contain this type. Migration must choose between a product configuration `ui_extension` for merchant UI and an `admin_link` for navigation. The URL pattern alone does not reveal which behavior the extension needs.

## Sources

- deleted `product-configuration-link*` template history
- commits `dbca95e`, `b3e2842`, and `54a2fde`
