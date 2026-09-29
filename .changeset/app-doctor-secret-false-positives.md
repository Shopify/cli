---
'@shopify/app': patch
---

The committed-secret check in `shopify app security` now only flags recognizable secret values (e.g. `shpss_`/`shpat_` tokens), not secret-sounding variable names or placeholders.
