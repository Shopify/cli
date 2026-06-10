---
'@shopify/cli': patch
---

Fix and deprecate `shopify search`. It now opens `https://shopify.dev/docs?search=<query>` directly (previously it opened a URL that 301-redirected there). The command is also marked deprecated in favor of `doc search`, which returns matching documentation as JSON for programmatic and agent-driven use. `search` keeps its existing browser behavior, so existing usage is unaffected.
