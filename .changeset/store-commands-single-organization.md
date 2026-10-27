---
'@shopify/cli': patch
---

Let `store delete` and `store info` find a store in the account's only organization, so a service account no longer needs `--organization-id` for stores it didn't create.
