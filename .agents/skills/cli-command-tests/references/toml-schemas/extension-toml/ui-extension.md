<!--
title: ui_extension_schema_history
description: Current and historical UI-extension TOML shapes, normalization, and fixture boundaries.
tags: [documentation, extensions, schemas, testing]
-->

# `ui_extension`

Admin UI, App Home UI, Checkout UI, Customer Account UI, POS UI, product configuration, validation settings, customer-segment, and other target-driven templates share this schema. A target name does not define a TOML schema version.

The schema does not describe every file consumed while loading an extension. [Extension dependencies and support files](../../extension-files.md) covers installed UI exports, tools/intent JSON contents, external schema references, and generation failures. An API-version value can enable type generation without creating a new TOML schema version.

## Current full locally visible schema

Use either the standalone envelope or an entry in `[[extensions]]`; see [README.md](README.md). Runtime contracts can add target-specific constraints.

```text
UIExtension := Base & {
  name: string
  type: "ui_extension"
  handle?: Handle
  uid?: UID
  api_version?: string
  description?: string

  # At least one of these two arrays is required.
  extension_points?: Target[]   # legacy key, still accepted
  targeting?: Target[]          # canonical key

  metafields?: Metafield[]
  capabilities?: Capabilities
  supported_features?: { runs_offline?: boolean }
  settings?: Settings
}

Target := {
  target: string
  module: string
  should_render?: { module: string }
  tools?: string
  instructions?: string
  intents?: Array<{
    type: string
    action: string
    schema: string
    name?: string
    description?: string
  }>
  metafields?: Metafield[]
  default_placement?: string
  urls?: { edit?: string }
  capabilities?: {
    allow_direct_linking?: boolean
    intercepts?: Array<{
      event: string
      blocking?: boolean = false
      applies_to?: string[]
    }>
  }
  preloads?: { chat?: string }
  assets?: string
}

Metafield := {
  namespace: string
  key: string
}

Capabilities := {
  network_access?: boolean
  block_progress?: boolean
  api_access?: boolean
  collect_buyer_consent?: {
    sms_marketing?: boolean
    customer_privacy?: boolean
  }
  iframe?: { sources?: string[] }
  bundle_size_exception?: boolean
}

Settings := {
  fields?: Array<{
    key?: string
    name?: string
    description?: string
    required?: boolean
    default_value?: unknown
    type: string
    validations?: unknown[]
    marketingActivityCreateUrl?: string
    marketingActivityDeleteUrl?: string
  }>
}
```

### Current normalization

The Zod transform chooses `targeting` before `extension_points` and emits canonical `extension_points`:

```text
sourceTargets = targeting ?? extension_points

canonical.extension_points = sourceTargets.map(target => ({
  target,
  module,
  metafields: target.metafields ?? extension.metafields ?? [],
  default_placement_reference: target.default_placement,
  urls: target.urls ?? {},
  capabilities: target.capabilities,
  preloads: target.preloads ?? {},
  tools, instructions, intents, assets,
  build_manifest: {
    assets: {
      main: { filepath: `${handle}.js`, module },
      should_render?: { filepath: `${handle}-conditions.js`, module: should_render.module }
    }
  }
}))
```

Do not write this build-time normalization back to TOML. It renames `default_placement`, adds generated paths, and chooses between two aliases.

## Structural versions

### U0 — legacy target names and standalone file (2022-11-23)

The first local UI schema used a standalone file and `extension_points`. Older CLI versions usually generated `shopify.ui.extension.toml`.

```text
{
  name: string
  type: surface-specific type
  extension_points: string[] | Target[]
  capabilities?: Capabilities
  metafields?: Metafield[]
  settings?: Settings
}
```

Surface-specific types included `checkout_ui_extension`, `customer_accounts_ui_extension`, and `pos_ui_extension`. See [legacy-types.md](legacy-types.md).

### U1 — unified `ui_extension` and `targeting` (2023-07-05 to 2023-07-20)

CLI added the unified envelope on 2023-07-05. Templates adopted `type = "ui_extension"` with `[[extensions.targeting]]` in July 2023. The schema kept accepting `extension_points` so older projects would still load.

Changes from U0:

- One generic `ui_extension` type replaced surface-specific types for new projects.
- Target objects moved to `targeting`.
- Each target gained `target` and `module`.
- One file could contain multiple extensions.

### U2 — root shared settings and extension-level name (2023-07-19)

[`f0e5d3398b`](https://github.com/Shopify/cli/commit/f0e5d3398b) added `settings` to the unified root. During the same series, root `name` became optional and names moved into extension entries.

Change from U1: every entry can inherit root `api_version`, `description`, and `settings`.

### U3 — consent capability (2023-09-12 to 2024-01-11)

- 2023-09-12: `capabilities.collect_buyer_consent.sms_marketing`.
- 2023-11-28: privacy consent capability.
- 2024-01-11: final key renamed to `customer_privacy`.

A migration must recognize the short-lived `write_privacy_consent` key when loading fixtures from this period. The current schema accepts only `customer_privacy`.

### U4 — default placement (2024-01-16 to 2024-05-14)

- 2024-01-16: CLI introduced `default_placement_reference`.
- 2024-05-14: public TOML key renamed to `default_placement` by [`b6e54badc1`](https://github.com/Shopify/cli/commit/b6e54badc1).

Current schema accepts `default_placement` and transforms it back to wire key `default_placement_reference`.

### U5 — UID (2024-04-14 / templates 2024-05-21)

[`5f77e0b25c`](https://github.com/Shopify/cli/commit/5f77e0b25c282a37e7e2d84ff6d3e333329cbfe2) added `uid` to BaseSchema and generation. Templates followed in [`b8bd001478`](https://github.com/Shopify/extensions-templates/commit/b8bd0014787ac38b1da5e86b997b13f359b44678).

### U6 — target capabilities and preload metadata (2024-07-29 to 2025-01-21)

This version added:

- `targeting[].capabilities.allow_direct_linking` (2024-07-29);
- `targeting[].preloads.chat` (2024-10-15);
- `targeting[].urls.edit` (2025-01-21);
- internal multi-asset build-manifest support, with no new public TOML key.

### U7 — target support files (2025-11-20 to 2026-04-21)

This version added these public keys:

- `tools` (2025-11-20);
- `instructions` (2026-01-07);
- `intents[]` (2026-01-16 locally, template examples in 2026-04);
- `assets` directory (2026-04-21).

The bundler copies these paths into the extension bundle. They can also drive generated TypeScript definitions.

### U8 — supported features (2026-01-15 / 2026-02-23)

CLI added `[extensions.supported_features] runs_offline = true`, primarily for POS UI extensions.

### U9 — target intercepts (2026-07-10 to 2026-08-28)

The final accepted shape is:

```toml
[extensions.targeting.capabilities]
[[extensions.targeting.capabilities.intercepts]]
event = "event-name"
blocking = false
applies_to = ["optional-scope"]
```

Earlier prototypes placed intercepts elsewhere. Only keep those fixtures when a released CLI generated or accepted them. Commits `86d164b627` through `b7ee9b1721` define the accepted structure.

## Cross-source differences

- Public Admin and Customer Account docs describe handles up to 100 characters; local CLI `HandleSchema` permits 50.
- Public docs generally call `uid` required; local Zod keeps it optional for compatibility.
- Public docs show only `targeting`; local Zod intentionally still accepts `extension_points`.
- Templates often omit optional capabilities/settings and therefore are examples, not schemas.
- `app-home`, Admin, Checkout, Customer Account, and POS templates share this type even when docs market them as separate extension products.

## E2E fixtures

Cover:

- U0 legacy standalone
- U1 unified
- U2 root inheritance
- U3 both consent names
- U4 both placement names
- U5 before and after UID
- U6 each nested target table
- U7 support paths
- U8 offline support
- U9 intercepts
- one current template for every surface and target family

## Sources

- `packages/app/src/cli/models/extensions/schemas.ts`
- `packages/app/src/cli/models/extensions/specifications/ui_extension.ts`
- [Admin UI configuration](https://shopify.dev/docs/api/admin-extensions/latest#configuration)
- [Checkout UI configuration](https://shopify.dev/docs/api/checkout-ui-extensions/latest#configuration)
- [Customer Account UI configuration](https://shopify.dev/docs/api/customer-account-ui-extensions/latest#configuration)
- [POS UI configuration](https://shopify.dev/docs/api/pos-ui-extensions/latest#configuration)
- Extension templates: `admin-*`, `app-*`, `checkout-extension`, `customer-account-extension`, `pos-*`, `product-configuration-extension`, and `validation-settings`.
