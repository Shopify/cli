---
'@shopify/app': patch
---

Fix `shopify app build` intermittently failing with "Source and destination must not be the same" on UI extensions when the local esbuild output directory and the bundle output directory resolve to the same path but differ as strings (e.g. due to `.` segments, trailing slashes, or path joining quirks). The same-path guard now normalizes both paths via `resolvePath` before comparison.
