---
'@shopify/cli': patch
---

Ship `fsevents` as an optional dependency so file watching on macOS uses native FSEvents instead of polling, which caused high CPU usage during `app dev` and `theme dev`.
