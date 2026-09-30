# Legacy `pos_ui_extension`

```text
LegacyPOSUI := Base & {
  name: string
  type: "pos_ui_extension"
  description?: string
  extension_points?: unknown
}
```

This type used a standalone `shopify.ui.extension.toml` and the `@shopify/retail-ui-extensions` renderer. The local specification deployed only `name`, `description`, and the renderer version.

## Versions and migration

- **POS0 (2022/2023):** legacy POS extension with one entry bundle.
- **POS1 (2023-01-25):** description added.
- **POS2 (2025 template transition):** target-driven POS templates use generic `ui_extension` with repeated `targeting` modules.

Migration depends on the target and template. Smart-grid, action, block, detail, post-purchase, background, and intercept templates use different target pairs. Changing only the type loses that distinction.

## Sources

- `pos_ui_extension.ts`
- historical `pos-ui-extension*` templates
- [POS UI configuration](https://shopify.dev/docs/api/pos-ui-extensions/latest#configuration)
