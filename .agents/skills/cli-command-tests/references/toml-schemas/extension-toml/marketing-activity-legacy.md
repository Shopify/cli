# Legacy `marketing_activity` / `marketing_activity_extension`

The last generated template used this public shape:

```text
MarketingActivity := {
  type: "marketing_activity"
  name: string
  handle: Handle
  uid?: UID
  title: string
  description: string
  api_path: string
  tactic: string
  marketing_channel: string
  referring_domain: string
  is_automation: boolean
  preview_data?: {
    types?: Array<{label: string, value: string}>
  }
  fields?: Array<{
    name: string
    heading: string
    body: string
    ui_type: string
  }>
}
```

## Versions and migration

- **MA0 — 2024-08-01:** template introduced `marketing_activity`.
- **MA1 — UID-era template:** identity plus preview/field metadata shown above.
- **MA2 — removed 2025-01-07:** template cleanup removed generation. CLI migration maps historical marketing module types to the modern `marketing_activity` app module remotely.

`marketing_activity_extension` is an older alias in the history. The platform handles migration through `migrateAppModule`; this is not a local TOML rewrite. Preserve unknown fields until the remote module confirms them.

## Sources

- deleted `marketing-activity` template
- `packages/app/src/cli/services/dev/migrate-app-module.ts`
