---
'@shopify/cli-kit': patch
'@shopify/theme': patch
'@shopify/app': patch
---

Updated the environment flag to support glob patterns

For commands that support multiple environments you can now use glob patterns
to specify the environments, e.g. `--environment "*-production"`. It's important
to wrap any glob patterns in quotes to ensure your shell does not expand the
value before passing it to the CLI.

This comes with a side effect that environments will be deduplicated.
