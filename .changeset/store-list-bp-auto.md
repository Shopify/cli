---
'@shopify/cli': minor
'@shopify/store': minor
'@shopify/organizations': minor
'@shopify/cli-kit': minor
---

Add `shopify store list` with `--from auto|organization|store-auth`. By default the command prefers your Shopify organization and falls back to locally stored store auth when the organization can't be listed for the current CLI session. When some organization lookups fail, the command still returns successful organizations with a warning and failure details for the skipped organizations.
