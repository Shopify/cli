---
'@shopify/app': patch
---

Deprecation warning for `--force` flag on `app deploy` and `app release`. The flag will be removed in the next major release. Use `--allow-updates` for CI/CD environments, or `--allow-updates --allow-deletes` if you also want to allow removals. The `SHOPIFY_FLAG_FORCE` environment variable is also deprecated.
