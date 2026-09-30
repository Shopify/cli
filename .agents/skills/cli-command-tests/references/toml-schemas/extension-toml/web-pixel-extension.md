# `web_pixel_extension`

## Current full locally visible schema

```text
WebPixel := Base & {
  name?: string
  type?: "web_pixel_extension"
  handle?: Handle
  uid?: UID
  runtime_context: string
  version?: string
  configuration?: unknown
  customer_privacy?: {
    analytics: boolean
    preferences: boolean
    marketing: boolean
    sale_of_data: "enabled" | "disabled" | "ldu"
  }
  settings?: unknown
}
```

Local Zod uses `zod.any()` for `configuration` and `settings`, so missing values parse as `undefined`. Predeploy rejects a truthy `configuration` because `settings` replaced it. The runtime contract defines current requiredness and the nested settings shape.

Current public settings shape:

```text
settings := {
  type: "object"
  fields: Record<string, {
    name: string
    description?: string
    type: "single_line_text_field"
    validations?: Array<{name: string, value: unknown}>
  }>
}
```

## Structural versions

- **WP0 — `configuration`:** original standalone schema used the legacy `configuration` settings definition.
- **WP1 — `settings`:** `settings` replaced `configuration`; current predeploy turns lingering legacy configuration into an actionable error.
- **WP2 — customer privacy (2023-11-01 to 2023-11-13):** added `[customer_privacy]` with all four fields and the three-value sale-of-data enum.
- **WP3 — UID (2024-04/05):** generated standalone files gained UID support.
- **WP4 — current strict runtime:** `runtime_context = "strict"`; public contract constrains settings to object/single-line fields even though local Zod uses `any`.

## Cross-source differences

The current template omits `[customer_privacy]`, while the docs show it and describe its defaults. Local Zod accepts any runtime-context string, but the docs and runtime contract require `strict`. Zod alone does not define this schema.

## E2E fixtures

Cover:

- WP0 `configuration` rejected at predeploy
- WP1 `settings`
- every WP2 privacy enum value
- an incomplete privacy object
- configs before and after UID
- omitted privacy defaults
- the wrong runtime context
- valid field validation
- an invalid settings field type

## Sources

- `packages/app/src/cli/models/extensions/specifications/web_pixel_extension.ts`
- [Build web pixels](https://shopify.dev/docs/apps/build/marketing/build-web-pixels)
- `web-pixel-extension/shopify.extension.toml.liquid`
