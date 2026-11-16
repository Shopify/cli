---
'@shopify/app': patch
'@shopify/cli': patch
---

Stop `app build` and `app function build` from crashing with `Unable to update lock within the stale threshold` when the function build lock is reported as compromised, for example on FUSE filesystems.
