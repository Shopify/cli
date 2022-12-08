---
'@shopify/ui-extensions-server-kit': major
---

Remove APICleint from ui-extensions-server-kit. APIClient is not used by the package and although it's exposed externally, all it's functionality is also handled by ExtensionServerClient
