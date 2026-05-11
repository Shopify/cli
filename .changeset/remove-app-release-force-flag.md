---
'@shopify/app': major
---

Remove the deprecated `--force` (`-f`) flag and `SHOPIFY_FLAG_FORCE` environment variable from `shopify app release`. Use `--allow-updates` for CI/CD environments, or `--allow-updates --allow-deletes` if you also want to allow removals. Passing both `--allow-updates` and `--allow-deletes` skips the confirmation prompt (matching the previous `--force` behavior).
