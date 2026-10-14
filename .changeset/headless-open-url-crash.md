---
'@shopify/cli-kit': patch
---

Don't crash `shopify auth login` when the browser can't be opened (for example, `spawn xdg-open ENOENT` in a headless container). The CLI now prints the login link and keeps waiting for you to approve it in any browser.
