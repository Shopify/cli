---
'@shopify/ui-extensions-server-kit': major
---

Remove APIClient from ui-extensions-server-kit. APIClient is not used by the package and although it's exposed externally, all its functionality is also handled by ExtensionServerClient
