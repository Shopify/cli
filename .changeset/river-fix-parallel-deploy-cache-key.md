---
'@shopify/app': patch
---

Fix `app deploy` cross-contaminating bundles between concurrent deploys of different apps in the same organization. The App Management `generateSignedUploadUrl` response was cached for 59 minutes using only the organization ID, so parallel `shopify app deploy --path=...` invocations would receive the same signed upload URL and overwrite each other's bundles. The cache key now also includes the app's API key and the current command, preserving the cache's benefit for `dev` hot-reload while keeping per-app deploys isolated.
