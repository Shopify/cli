---
'@shopify/app': patch
---

Fix crash when organization is not found in app-management-client by throwing NoOrgError instead of accessing properties on undefined
