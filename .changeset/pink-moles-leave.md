---
'@shopify/theme': patch
---

Fix `shopify theme dev --theme-editor-sync` to avoid deleting files during race conditions, especially when multiple changes come from an external process (e.g., AI coding tools)
