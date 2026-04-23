---
'@shopify/theme': patch
---

Fix `ENOTDIR` error when a file path is passed to `--path` flag in theme commands. The flag now validates that the provided path is a directory and shows a helpful error message suggesting the parent directory instead.
