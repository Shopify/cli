<!--
title: shopify_extension_toml_schema_history
description: Historical Shopify extension configuration shapes and their evidence.
tags: [documentation, cli, extensions, toml, testing]
-->

# `shopify.extension.toml` schema history

This directory tracks the distinct `shopify.extension.toml` structures that Shopify CLI has accepted or generated. Use this history to choose meaningful fixtures and, when requested, design a `match` / `up` migration chain that produces one canonical shape.

## Evidence and scope

These formats are shared inputs for extension-loading, generation, build, and deployment workflows. A command test should use the variants reached by its reader and phase, not every fixture below indiscriminately. Build/deploy transforms do not automatically run during local loading.

Historical shapes and migration suggestions are distinct from current acceptance. Read this scope before a per-type page; instructions to migrate, rename, or apply an `up` function describe migration design unless an existing implementation is cited and verified.

The inventory cross-references three sources:

- **Shopify CLI:** local checkout `8829ed581d25f964c53564c403bfbf94484753b4` and its Git history.
- **Extension templates:** [`Shopify/extensions-templates`](https://github.com/Shopify/extensions-templates), checkout `9cae73fb629863b147f88d9d851610cfb00ddcc0`, including renamed and deleted templates in Git history.
- **Public docs:** [Configure app extensions](https://shopify.dev/docs/apps/build/app-extensions/configure-app-extensions) and every extension-specific configuration page linked from it.

An **introduction date** is the earliest date verified in one of these sources, not necessarily the platform launch date. Commit links provide the evidence.

A **schema version** marks a structural change: a new envelope, an added or removed property, a rename, a type or requiredness change, or a new invariant. API-version bumps, sample target changes, formatting, comments, dependency changes, and source-language variants do not count.

Each type file starts with the complete current structure, then lists cumulative historical changes. Apply each change to the preceding shape to reconstruct that version. The files state both sides of every removal and rename, without repeating the shared Base and unchanged fields. If the sources do not contain an old runtime contract or prototype, the document calls out the gap instead of guessing.

## Validation comes from two sources

The local Zod files are only part of the source of truth. `fetch-extension-specifications.ts` merges local specifications with JSON Schema contracts from the extension-specifications API. `unifiedConfigurationParserFactory()` runs Zod first, then the fetched contract. Contract validation rejects unknown properties for extension modules.

What this means:

- Locally implemented types have a reviewable Zod schema plus a runtime contract.
- This repository alone cannot reconstruct the full validator for contract-only types such as `channel_config`, `order_attribution_config`, `admin_link`, `subscription_link_extension`, `terminal_management`, and `flow_trigger_lifecycle_callback`.
- The templates and public docs define the public shape for those types, but a contract might contain gated or unpublished fields.
- A durable versioned-schema system should version the fetched contracts or generate checked-in schemas from them. Otherwise, E2E fixtures can drift without a code change.

Relevant code:

- `packages/app/src/cli/services/generate/fetch-extension-specifications.ts`
- `packages/app/src/cli/utilities/json-schema.ts`
- `packages/app/src/cli/models/extensions/schemas.ts`
- `packages/app/src/cli/models/app/loader.ts`

## File envelopes shared by all extension types

### E0 — standalone extension (legacy, still accepted)

Earliest CLI evidence: 2022-11-03. Earliest template-repository evidence: 2023-05-11.

```text
ExtensionConfig := {
  name?: string
  type: string
  handle?: Handle
  uid?: UID
  ...type-specific properties
}
```

One file represents one extension. Older versions generated `shopify.ui.extension.toml` and `shopify.theme.extension.toml`. Shopify standardized the name as `shopify.extension.toml` on 2023-07-26. The filename does not identify the data shape.

### E1 — unified extension array

CLI introduced this envelope on 2023-07-05 in [`ef03fc0b2f`](https://github.com/Shopify/cli/commit/ef03fc0b2f13685abd5fa5ee465883191e0e9b7b). One file can hold several extensions and share root values between them.

```text
UnifiedConfig := {
  api_version?: string
  description?: string
  settings?: Settings
  extensions: ExtensionConfig[]
}
```

The loader computes each extension as:

```text
mergedExtension = { ...unifiedConfig, ...extensionEntry }
```

An extension entry wins over the corresponding root value. The merge retains the root `extensions` property, but the CLI removes it before contract deployment.

Early E1 briefly required a root `name`; it became optional on 2023-07-19 and `name` moved into each extension entry. This transitional shape deserves its own parser fixture even though current schemas accept it only as an unknown/contract-dependent property.

### E2 — UID-bearing envelope

CLI began generating `uid` on 2024-04-14 ([`5f77e0b25c`](https://github.com/Shopify/cli/commit/5f77e0b25c282a37e7e2d84ff6d3e333329cbfe2)); templates added it on 2024-05-21 ([`b8bd001478`](https://github.com/Shopify/extensions-templates/commit/b8bd0014787ac38b1da5e86b997b13f359b44678)). `uid` remains optional in the local base Zod schema because pre-UID projects must load, but current docs and generated templates treat it as required.

### E3 — contract-strict envelope

Introduced on the checked-out branch on 2026-03-27 by [`9205739076`](https://github.com/Shopify/cli/commit/9205739076). Runtime JSON Schema validation rejects additional extension properties. This changed acceptance behavior without changing most local Zod objects.

## Shared local schema

The current local base accepts these properties before the CLI applies a type-specific schema and runtime contract:

```text
Handle := trimmed string, 1..50 chars, /^[A-Za-z0-9-]+$/,
          not beginning or ending with "-"
UID    := trimmed string, 1..250 chars, /^[A-Za-z0-9-${}.()_`]+$/,
          not beginning or ending with "-"

Base := {
  name?: string
  type?: string
  handle?: Handle
  uid?: UID
  description?: string
  api_version?: string
  extension_points?: unknown
  capabilities?: {
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
  supported_features?: { runs_offline?: boolean }
  settings?: {
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
}
```

Some public limits differ from local validation. For example, the Admin and Customer Account UI docs allow 100-character handles, while the CLI allows 50. E2E tests should check the local limit separately from platform-contract validation.

## Current type inventory

| TOML `type`                       | File                                                                     | Validation source                          |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `ui_extension`                    | [ui-extension.md](ui-extension.md)                                       | local Zod + runtime contract               |
| `function`                        | [function.md](function.md)                                               | local Zod + runtime contract               |
| `payments_extension`              | [payments-extension.md](payments-extension.md)                           | local Zod union + runtime contract         |
| `flow_action`                     | [flow-action.md](flow-action.md)                                         | local Zod + runtime contract               |
| `flow_trigger`                    | [flow-trigger.md](flow-trigger.md)                                       | local Zod + runtime contract               |
| `flow_template`                   | [flow-template.md](flow-template.md)                                     | local Zod + runtime contract               |
| `flow_trigger_lifecycle_callback` | [flow-trigger-lifecycle-callback.md](flow-trigger-lifecycle-callback.md) | runtime contract                           |
| `editor_extension_collection`     | [editor-extension-collection.md](editor-extension-collection.md)         | local Zod + runtime contract               |
| `admin_link`                      | [admin-link.md](admin-link.md)                                           | runtime contract with local build behavior |
| `checkout_post_purchase`          | [checkout-post-purchase.md](checkout-post-purchase.md)                   | local Zod + runtime contract               |
| `theme`                           | [theme.md](theme.md)                                                     | local Zod + runtime contract               |
| `web_pixel_extension`             | [web-pixel-extension.md](web-pixel-extension.md)                         | local Zod + runtime contract               |
| `tax_calculation`                 | [tax-calculation.md](tax-calculation.md)                                 | local Zod + runtime contract               |
| `subscription_link_extension`     | [subscription-link-extension.md](subscription-link-extension.md)         | runtime contract                           |
| `channel_config`                  | [channel-config.md](channel-config.md)                                   | runtime contract                           |
| `order_attribution_config`        | [order-attribution-config.md](order-attribution-config.md)               | runtime contract                           |
| `terminal_management`             | [terminal-management.md](terminal-management.md)                         | runtime contract                           |

Historical types and aliases are in [legacy-types.md](legacy-types.md).

## Template coverage

Several top-level template directories share one schema and differ only by target or implementation language:

- Admin, App Home, Checkout, Customer Account, POS, product configuration, validation settings, and customer-segment templates all use `ui_extension`.
- Every `functions-*-(js|rs|wasm)` directory uses `function`; language changes only `[extensions.build]` values.
- Six `payments-app-extension-*` directories use one target-discriminated `payments_extension` union.
- `admin-link`, `support-link`, `app-action-link`, and `discount-app-action-link` use `admin_link`.

Targets, API-version values, and implementation languages do not create separate schema versions.

## Not `shopify.extension.toml`

The public index also links Events and webhook subscriptions. Their current schemas live in `shopify.app.toml` (`[events]` and `[webhooks]`), so this inventory excludes them. The CLI models them as configuration modules, which need a separate transformation design.

## Recommended canonical migration chain

**Design proposal, not an existing universal CLI migration pipeline.** Use current readers and fetched contracts to establish the behavior under test. Do not implement these migrations as part of writing command tests.

Do not use one giant union with transforms. Use explicit, ordered migrations:

1. **Detect envelope**: standalone E0 or unified E1/E2/E3.
2. **Normalize envelope**: produce one extension record per `[[extensions]]` entry, applying root inheritance explicitly.
3. **Normalize identity**: preserve/generate `handle` and `uid` under caller control; never silently invent them during validation.
4. **Normalize type aliases**: map historical types to canonical types only where platform migration semantics are known.
5. **Run type migrations**: for example, UI `extension_points` → `targeting`, editor collection `[[include]]` → `includes`, Function `targets` → `targeting`.
6. **Validate canonical schema**: local checked-in schema generated from the runtime contract.
7. **Keep deployment transforms separate**: mappings such as `payment_session_url` → `start_payment_session_url` are wire transforms, not TOML schema migrations.

Each `match` must be mutually exclusive or report an ambiguity. Test every `up` for idempotence and information preservation with fixtures.

## Minimum E2E fixture matrix

This is the candidate matrix for an extension-schema/migration suite. For a command suite, select the rows its loading/validation/build/deploy paths can consume. For an applicable current type, consider:

- standalone pre-UID
- standalone UID-bearing
- unified pre-UID
- unified UID-bearing
- the current generated example
- each type-specific historical version listed in its file
- rejection of an unknown property under a strict fetched contract
- root-versus-entry overrides for `api_version`, `description`, and `settings`

For UI and Functions, add legacy-key fixtures (`extension_points`, Function `targets`) and every build/target variant. For payments, add one valid and one target-mismatch fixture per union member.
