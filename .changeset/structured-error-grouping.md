---
'@shopify/cli-kit': patch
---

Group CLI crash reports on structured error signals instead of one catch-all bucket

Bugsnag error grouping now derives a stable `slice:category:signature` hash from the original typed error's HTTP status and GraphQL `extensions.code` (falling back to the shared keyword categorizer, and to Bugsnag's stack-trace grouping for genuinely unknown errors). The same signals are emitted as `error_grouping` metadata so backend routing works regardless of CLI version. Known-transient API errors (HTTP 401/429 and `THROTTLED`) are now treated as expected and kept out of crash reporting.
