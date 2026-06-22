---
'@shopify/cli-kit': minor
'@shopify/app': patch
---

Extract the shared Admin API bulk-operation engine into `@shopify/cli-kit/node/api/bulk-operations` (run query/mutation, stage file, watch/poll, download, fetch, cancel, status/cancellation formatting, version resolution, and id helpers). The `shopify app bulk` commands now consume this shared engine instead of their own copies, with no change to their behavior.
