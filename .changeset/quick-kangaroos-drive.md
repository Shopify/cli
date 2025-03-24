---
'@shopify/app': patch
---

Introduced a `--use-localhost` flag as a developer preview

When running `shopify app dev --use-localhost` a tunnel won't be used. Instead, the app will be loaded using https localhost. A self-signed cert will be generated using [mkcert](https://github.com/FiloSottile/mkcert).

`--use-localhost` is not compatible with Shopify features which directly invoke your app (such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another device (such as POS).

We are releasing this as a hidden flag to gather feedback. Please report any issues and provide feedback on the [dev community](https://community.shopify.dev/new-topic?title=[Feedback%20for%20--use-localhost]&category=shopify-cli-libraries&tags=app-dev-on-localhost).
