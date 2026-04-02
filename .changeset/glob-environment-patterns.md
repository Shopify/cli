---
'@shopify/cli-kit': patch
'@shopify/theme': patch
---

Add glob pattern support for the `--environment` flag. You can now use patterns
like `--environment "*-production"` to target multiple environments at once.
Wrap glob patterns in quotes to prevent shell expansion.
