---
'@shopify/theme': patch
---

Surface invalid `theme check` configurations as a clear error instead of crashing. A missing or invalid `--config` value (or a malformed `.theme-check.yml`) now shows an actionable message rather than an unexpected error report.
