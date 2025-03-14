---
'@shopify/app': patch
---

Added a --use-localhost flag to shopify app dev (E.g: shopify app dev --use-localhost).

When the --use-localhost flag is present a tunnel won't be used. Instead, the app will be loaded using https localhost. A self-signed cert will be generated using mkcert. This flag works for testing App Bridge, Admin UI, Checkout UI or Pixel extensions. Do not use it for testing Webhooks, Flow Action, App Proxy or POS features.

We are releasing this as a hidden flag to gather feedback. If you encounter issues, please post here: https://community.shopify.dev/new-topic?title=[Feedback%20for%20--use-localhost]&category=shopify-cli-libraries&tags=app-dev-on-localhost
