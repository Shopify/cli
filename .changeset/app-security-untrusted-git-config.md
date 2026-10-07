---
'@shopify/app': patch
'@shopify/cli': patch
---

`shopify app security check` only reads from Git: it no longer starts file-system monitors or fetches missing objects, and it doesn't use repositories committed inside the scanned directory
