---
'@shopify/store': patch
---

Preview store creation now labels its requests (`source: "shopify_cli"`) and opts in to the backend's warm pool (`pool: true`). Inert until the backend enables the pool for this source; creation falls back to inline behavior otherwise, with an unchanged response shape.
