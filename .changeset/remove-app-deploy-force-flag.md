---
'@shopify/app': major
---

Remove the deprecated `--force` (`-f`) flag and `SHOPIFY_FLAG_FORCE` environment variable from `shopify app deploy`. Use `--allow-updates` for CI/CD environments, or `--allow-updates --allow-deletes` if you also want to allow removals. The `--no-release` flag continues to work and implicitly allows updates and deletes.
