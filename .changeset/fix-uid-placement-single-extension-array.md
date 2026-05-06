---
'@shopify/app': patch
---

Fix `uid` being inserted at the top level of extension TOML files (outside the `[[extensions]]` block) during `shopify app init` and other `linkedAppContext` flows when the TOML uses the modern `[[extensions]]` array-of-tables shape with a single entry — the shape produced by current `app init` templates. Previously, single-entry arrays fell into the legacy top-level `file.patch` branch; `uid` is now inserted inside the `[[extensions]]` block (after `handle`) for any array shape, regardless of length. Legacy single-extension TOMLs with top-level `type`/`handle` fields continue to use the top-level patch path.
