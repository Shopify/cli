---
'@shopify/app': patch
---

Fix `SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH` env var not working when `SHOPIFY_CLI_1P_DEV` is enabled. The template override now works consistently regardless of which developer platform client is selected.
