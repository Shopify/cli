---
'@shopify/app': patch
---

Skip asset manifest generation in the UI extension bundle step when the local esbuild output directory and the bundle output directory resolve to the same path. Previously the same-path guard only skipped the file copy and still ran `createOrUpdateManifestFile`, which could produce or update a manifest in the local output unintentionally.
