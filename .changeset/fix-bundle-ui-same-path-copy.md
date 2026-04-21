---
'@shopify/app': patch
---

Fix `shopify app build` failing for UI extensions with `Source and destination must not be the same`. The bundle_ui step was unconditionally copying the bundled output into the extension's bundle directory, but during a plain build those paths are the same directory.
