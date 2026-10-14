---
'@shopify/cli-kit': minor
---

Add `SHOPIFY_SERVICE_ACCOUNT_TOKEN` to run `shopify organization list`, `shopify store list`, `shopify store create dev`, `shopify store info`, `shopify store delete` and app commands with a service account token. It can't be set together with `SHOPIFY_APP_AUTOMATION_TOKEN` or `SHOPIFY_CLI_PARTNERS_TOKEN`, and commands that need your Shopify account or a store's Admin API access, such as `shopify store execute`, refuse to run while it's set.
