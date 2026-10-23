---
'@shopify/app': patch
---

`app dev` no longer watches build output (Rust `target` directories and function `dist` directories), the CLI's own `.shopify` files, `.DS_Store` or editor swap files. This cuts file watcher CPU and memory, especially for Rust functions on macOS.
