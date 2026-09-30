# `admin_link`

The CLI fetches the complete `admin_link` JSON Schema at runtime. Public docs and current templates define this public shape:

```text
AdminLink := {
  name: string
  description?: string
  handle: Handle
  type: "admin_link"
  uid?: UID                 # required by current docs/generation
  targeting: Array<{
    target: string
    url: string
    tools?: string
    instructions?: string
    intents?: Array<{
      type: string
      action: string
      schema: string
      name?: string
      description?: string
    }>
  }>
}
```

Local CLI build steps bundle `tools`, `instructions`, and intent schema files. The runtime contract sets target and URL cardinality, along with target-specific rules.

## Structural versions

- **AL0 — initial contract/template (2024-10-07):** `[[extensions]]` with `name`, `handle`, `type`, and `[[extensions.targeting]] {target,url}`.
- **AL1 — UID/localization (late 2024 to 2025-02):** generation added UID and localized `t:name`; support-link became another target using the same schema.
- **AL2 — app intents (2026-01 to 2026-04):** added target-level `tools`, `instructions`, and `intents[]`. `app-action-link` and `discount-app-action-link` are examples; the latter demonstrates two extension entries in one file.

## Cross-source differences

The current public tutorial uses `admin.product.action.link`, while the template uses `admin.product-details.action.link`. That is a target vocabulary change, not a schema change. Templates place support-file keys after the target, so TOML nests them under that target.

## E2E fixtures

Cover:

- AL0 absolute and relative URL behavior
- configs before and after UID
- a localized name
- a support target
- one and two intents
- two admin links in one file
- a missing URL
- a missing target
- omitted support files

## Sources

- `packages/app/src/cli/models/extensions/specifications/admin_link.ts`
- [Admin link tutorial](https://shopify.dev/docs/apps/build/admin/admin-links/create-admin-links)
- `admin-link`, `support-link`, `app-action-link`, and `discount-app-action-link` templates
