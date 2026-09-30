# `flow_trigger`

## Current full locally visible schema

```text
FlowTrigger := Base & {
  name: string
  type: "flow_trigger"
  handle: Handle
  uid?: UID
  description?: string
  schema?: string
  settings?: {
    fields?: TriggerField[]
  }
}

TriggerField := {
  type: string
  key?: string matching /^[A-Za-z\s]*$/
  name?: string
  description?: string
  required?: boolean
  default_value?: unknown
  validations?: unknown[]
  marketingActivityCreateUrl?: string
  marketingActivityDeleteUrl?: string
}
```

Semantic validation distinguishes reference fields from custom fields. A field that references `schema.<type>` requires `schema`.

## Structural versions

### FT0 — first CLI schema (2023-06-08)

The first schema used a standalone config with `name`, `type = "flow_trigger"`, a description, and payload fields.

### FT1 — revised `[settings]` format (2023-06-16)

Trigger fields moved to `[settings]` with repeated `[[settings.fields]]` entries.

### FT2 — handle and unified envelope (2023-07-06 to 2023-07-12)

Added required `handle` and wrapped the trigger in `[[extensions]]`.

### FT3 — `name` to `key` and field validation (2023-07-21)

Custom trigger payload fields use `key`, which accepts ASCII letters and whitespace (`\s`). Reference fields omit it.

### FT4 — custom schema types (2023-08-01 to 2023-08-16)

Added top-level `schema` and support for field types named `schema.<type>`. A trigger using one of those types without `schema` is invalid.

### FT5 — UID (2024-04-14 / template 2024-05-21)

Added common `uid` generation.

## Cross-source differences

- Public docs call `description` required; local BaseSchema leaves it optional.
- The current template demonstrates only reference and string fields and omits `schema`.
- Base `FieldSchema` accepts some properties that Flow's semantic validator rejects for specific field types. Test the parser and semantic validator separately.

## E2E fixtures

Cover:

- FT0 standalone
- FT2 unified
- configs before and after UID
- a reference field without a key
- a custom field with a key
- invalid punctuation in a key
- `schema.<type>` with and without a schema file
- mixed field types

## Sources

- `packages/app/src/cli/models/extensions/specifications/flow_trigger.ts`
- `packages/app/src/cli/services/flow/validation.ts`
- [Flow trigger reference](https://shopify.dev/docs/apps/build/flow/triggers/reference)
- `flow-trigger/shopify.extension.toml.liquid`
