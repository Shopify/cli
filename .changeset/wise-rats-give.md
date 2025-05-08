---
'@shopify/app': minor
---

Made the `--use-localhost` and `--localhost-port` flags public for the `shopify app dev` command

When the `--use-localhost` flag is present a tunnel won't be used. Instead, the app will be loaded using https localhost. A self-signed cert will be generated using mkcert. This flag is not compatible with Shopify features which directly invoke your app (such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another'.

`--use-localhost` will always try to use port 3458. If port 3458 is not available the CLI will warn the user and automaticlly select a different port.  Alternatively use the `--localhost-port` flag to specify that you want to develop using localhost on a specific port.  For example: `shopify app dev --localhost-port=4000`.
