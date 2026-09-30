# `flow_action`

## Current full locally visible schema

```text
FlowAction := Base & {
  name: string
  type: "flow_action"
  handle: Handle
  uid?: UID
  description?: string

  runtime_url: FlowURL
  validation_url?: FlowURL
  config_page_url?: FlowURL
  config_page_preview_url?: FlowURL
  schema?: string
  return_type_ref?: string

  settings?: {
    fields?: Field[]
  }
}

FlowURL := absolute HTTPS URL | app-relative path beginning with one "/"

Field := {
  type: string
  key?: string
  name?: string
  description?: string
  required?: boolean
  default_value?: unknown
  validations?: unknown[]
  marketingActivityCreateUrl?: string
  marketingActivityDeleteUrl?: string
}
```

Semantic validation checks field shapes, requires the related custom-configuration URLs as a set, and keeps `schema` and `return_type_ref` in sync. The CLI resolves relative top-level Flow URLs against the dev tunnel during `app dev` and against `application_url` during deploy. Marketing activity URLs must remain absolute.

## Structural versions

### FA0 — first CLI schema (2023-06-08)

The first schema used a standalone config with `name`, `type = "flow_action"`, `description`, an execution URL, and settings fields.

### FA1 — revised Flow TOML (2023-06-16)

Flow templates and validators adopted:

```toml
runtime_url = "https://..."
[settings]
[[settings.fields]]
```

Use release fixtures to recover names from the first prototype. The public template repository had already replaced them by 2023-07-21.

### FA2 — schema and return type (2023-06-14 to 2023-06-28)

This version added `schema` and `return_type_ref`. Deployment loads the file contents as a schema patch.

### FA3 — handle and unified envelope (2023-07-06 to 2023-07-12)

`handle` became mandatory for Flow and the generated file moved to `[[extensions]]`.

### FA4 — UID (2024-04-14 / template 2024-05-21)

Added the common optional-at-load, generated-for-new-projects `uid`.

### FA5 — relative URLs (2026-05-29 to 2026-06-04)

`runtime_url`, `validation_url`, `config_page_url`, and `config_page_preview_url` began accepting app-relative paths. Before this version, use absolute HTTPS URLs.

## Cross-source differences

- Public docs call `description` required; local BaseSchema makes it optional.
- Public examples omit `uid` in some pages even though current generation includes it.
- The template contains only `runtime_url`. The docs and validators support the three configuration and validation URL properties plus the return schema, but generation omits them.

## E2E fixtures

Cover:

- standalone FA0
- unified FA3
- configs before and after UID
- a complete custom-configuration URL set
- each invalid incomplete URL set
- schema with return type
- absolute URLs
- valid relative URLs
- invalid protocol-relative URLs

## Sources

- `packages/app/src/cli/models/extensions/specifications/flow_action.ts`
- `packages/app/src/cli/services/flow/validation.ts`
- [Flow action reference](https://shopify.dev/docs/apps/build/flow/actions/reference)
- `flow-action/shopify.extension.toml.liquid`
