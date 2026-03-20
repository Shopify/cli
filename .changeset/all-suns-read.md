---
'@shopify/cli-kit': patch
---

Remove `custom-oclif-loader.ts` and use oclif's `Config` directly. The development-only shim for loading a local `@shopify/cli-hydrogen` plugin is no longer needed as the Hydrogen repo now handles this via its own patch scripts.
