---
'@shopify/cli': major
---

Change `app function run --json` to emit one validated result or `{error: ...}` envelope, send diagnostics as JSON events on stderr, and exit nonzero when `success` is false.
