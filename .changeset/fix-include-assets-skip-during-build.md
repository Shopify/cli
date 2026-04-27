---
'@shopify/app': patch
---

Fix `shopify app build` failing with "Source and destination must not be the same" on UI extensions that declare configKey-resolved assets (e.g. `tools`, `instructions`, `extension_points[].intents[].schema`).

`shopify app dev` and `shopify app deploy` reassign each extension's `outputPath` to a bundle directory (`.shopify/dev-bundle/<uid>` or `.shopify/deploy-bundle/<uid>`) before the build steps run. `shopify app build` doesn't — `outputPath` stays at its constructor default, so the `include_assets` step's `outputDir` collapsed onto `extension.directory`. The configKey/static/pattern copy helpers then forwarded source files onto themselves, which fs-extra rejects.

The `include_assets` step now short-circuits when `outputDir` resolves to `extension.directory`. There's no bundle to populate during `shopify app build`; copying source files onto themselves and writing `manifest.json` into the user's source tree are both wrong.
