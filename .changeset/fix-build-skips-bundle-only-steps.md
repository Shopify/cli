---
'@shopify/app': patch
---

Fix `shopify app build` failing with "Source and destination must not be the same" on UI extensions that declare configKey-resolved assets (e.g. `tools`, `instructions`, `extension_points[].intents[].schema`).

Client steps under `lifecycle: 'deploy'` fall into two categories: build-safe steps that produce local artifacts (`bundle_ui`, `build_theme`, `build_function`, `create_tax_stub`) and bundle-only steps that copy source files into the dev/deploy bundle directory (`include_assets`, `bundle_theme`). `shopify app build` was running both, but it doesn't reassign `extension.outputPath` to a bundle directory the way `shopify app dev` and `shopify app deploy` do — the bundle-only steps then collapse onto the extension's source tree, fail same-path copies, and write `manifest.json` into source.

`extension.build()` now accepts an `includeBundleSteps` option that filters bundle-only step types out by default. `buildForBundle` (used by dev/deploy) opts in to running every step, so behaviour there is unchanged.
