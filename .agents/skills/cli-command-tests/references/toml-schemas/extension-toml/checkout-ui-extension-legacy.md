# Legacy `checkout_ui_extension`

Before `ui_extension`, Checkout used this standalone schema:

```text
LegacyCheckoutUI := Base & {
  name: string
  type: "checkout_ui_extension"
  handle?: Handle
  api_version?: string
  extension_points?: string[]
  metafields?: Array<{namespace: string, key: string}>
  capabilities?: Capabilities
  settings?: {fields?: unknown}
}
```

Before 2023-07-26, the CLI generated `shopify.ui.extension.toml`.

## Versions and migration

- **CUI0 (2022-era):** string `extension_points` and one source entry file.
- **CUI1 (2023):** handle/api version/metafields/capabilities accumulated in Base.
- **CUI2 (July 2023):** new projects became generic `ui_extension` with object `targeting` entries.

Migration needs a module path for every old extension-point string. TOML alone does not always provide that path, so the migration might need the historical default entry file. A type rename is not enough.

## Sources

- `checkout_ui_extension.ts` history
- old loader tests
- the public filename-differences note
