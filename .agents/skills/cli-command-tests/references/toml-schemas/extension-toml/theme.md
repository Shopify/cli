# `theme`

## Current full locally visible schema

```text
Theme := Base & {
  name?: string
  type?: "theme"
  handle?: Handle
  uid?: UID
}
```

Files under `assets/`, `blocks/`, `locales/`, and `snippets/` define theme behavior. The TOML needs no extra behavior fields. The runtime contract requires the public `name` and `type` fields.

## Structural versions

- **TH0 — legacy filename:** `shopify.theme.extension.toml`, with `name` and `type = "theme"`.
- **TH1 — standardized filename (2023-07-26):** same data shape in `shopify.extension.toml`.
- **TH2 — optional handle:** docs explicitly support `handle`; CLI can derive it when omitted.
- **TH3 — UID-bearing generation (2024):** CLI supports UID in Base, although the current template’s conditional renders it only when supplied and the public theme example remains minimal.

The CLI accepted a `build_directory` key around 2023-08-23. The current local Base and public docs omit it. Migrate generated assets into the standard extension directories instead of carrying this key forward.

## E2E fixtures

Cover:

- both filenames
- minimal `name` and `type`
- an optional handle
- UID
- historical `build_directory`
- an invalid extra property under the strict runtime contract

## Sources

- `packages/app/src/cli/models/extensions/specifications/theme.ts`
- [Theme app extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)
- `theme-extension/shopify.extension.toml.liquid`
