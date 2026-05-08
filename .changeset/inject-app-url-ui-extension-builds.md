---
'@shopify/app': patch
---

Default `process.env.APP_URL` to the app configuration `application_url` when bundling UI extensions for production builds, while preserving `.env` and shell environment variable overrides.
