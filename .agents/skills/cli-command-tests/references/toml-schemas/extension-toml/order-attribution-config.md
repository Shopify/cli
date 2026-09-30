# `order_attribution_config`

A runtime contract validates this type. The current template defines:

```text
OrderAttributionConfig := {
  type: "order_attribution_config"
  handle: Handle
  name: string
  definitions: Array<{
    handle: string
    display_name: string
    icon?: string
  }>
}
```

The CLI bundles SVG files under `icons/`, and `icon` paths refer to those assets. The local specification uses a single-UID strategy, but the template does not render `uid`.

## Structural versions

- **OA0 — introduced 2026-04-15:** initial commit added type, identity, and repeated definitions.
- **OA1 — same day correction:** template commit `a037462973` produced the current names/shape. Keep both commits as fixtures because the first was externally visible in repository history.

## E2E fixtures

Cover:

- each OA template revision
- one and multiple definitions
- an omitted icon
- valid and missing icon files
- a duplicate definition handle
- SVG and non-SVG assets
- handle and UID strategy behavior

## Sources

- `packages/app/src/cli/models/extensions/specifications/order_attribution_config.ts`
- `order-attribution-config/shopify.extension.toml.liquid`
- CLI commit `3ed731390f`
