# `channel_config`

A runtime JSON Schema contract validates `channel_config`. The current template defines this public shape:

```text
ChannelConfig := {
  type: "channel_config"
  name: string
  description?: string
  handle: Handle
  create_legacy_channel_on_app_install?: boolean
}
```

The CLI bundles `.json`, `.toml`, `.yaml`, `.yml`, and `.svg` files under `specifications/`. They are assets, not TOML properties.

## Structural versions

- **CC0 — `channel_specification` (2025-01-24):** original template/type name; see [channel-specification-legacy.md](channel-specification-legacy.md).
- **CC1 — `channel_config` rename (2025-08-29 to 2025-09-12):** local specification and template moved to `channel_config`.
- **CC2 — legacy-channel creation flag (2025-09-18):** added `create_legacy_channel_on_app_install`.
- **CC3 — extension-level metadata (2025-11-13/26):** runtime payload/contract began retaining channel-config fields such as name and description.
- **CC4 — single-UID contract form (2026-03-19):** current contract-based implementation uses a single UID strategy; the template itself does not render `uid`.

## E2E fixtures

Cover:

- the CC0 alias
- a minimal CC1 config
- the legacy-channel flag omitted, `true`, and `false`
- an optional description
- every supported specification asset extension
- an unsupported asset extension
- handle and UID behavior
- an unknown contract field

## Sources

- `packages/app/src/cli/models/extensions/specifications/channel.ts`
- `channel-config/shopify.extension.toml.liquid`
