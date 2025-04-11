---
'@shopify/app': minor
---

Improved how port selection when using localhost development

Added a `--localhost-port` flag. Use this to specify that you want to develop using localhost on a specific port.  For example: `shopify app dev --localhost-port=4000`

`shopify app dev --use-localhost` will always try to use port 3458. If port 3458 is not available the CLI will warn the user and select a different port.

