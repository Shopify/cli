---
'@shopify/app': minor
---

Warn during build and deploy when a theme app extension loads from or sends requests to origins that its `[extensions.capabilities.network_access] allowed_sources` doesn't declare, and add the `THEME_EXTENSION_UNDECLARED_EGRESS` app security check.
