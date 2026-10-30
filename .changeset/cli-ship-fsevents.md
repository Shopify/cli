---
'@shopify/cli': patch
---

Use native FSEvents by default on macOS to reduce `app dev` and `theme dev` CPU use while preserving `CHOKIDAR_USEPOLLING`.
