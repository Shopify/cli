---
'@shopify/app': patch
---

App Doctor's committed-secret check now only flags recognizable secret values (e.g. `shpss_`/`shpat_` tokens), not secret-sounding variable names or placeholders.
