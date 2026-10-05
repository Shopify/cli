---
id: EOL_API_VERSION
version: 1
severity: low
precedence: prefer-agent
---

# Eol Api Version

Inspect the selected `shopify.app*.toml` plus React Router `app/shopify.server.*` declarations. Shopify publishes quarterly versions in January, April, July, and October and supports each stable version for 12 months; the app security check allows a documented 30-day extension grace period before reporting it as end-of-life. Cite the exact declaration. For malformed config, computed `ApiVersion` values, or a Shopify-announced exceptional extension, inspect the source and current lifecycle policy rather than inferring from unrelated constants.
