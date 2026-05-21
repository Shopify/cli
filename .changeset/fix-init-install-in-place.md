---
'@shopify/app': patch
---

Fix `shopify app init` leaving dangling `node_modules` symlinks on Windows when using `pnpm` (and similarly affected package managers). The scaffolded project is now moved to its final directory before dependencies are installed, so package-manager-managed symlinks/junctions resolve to the final location instead of the temporary scaffold path.
