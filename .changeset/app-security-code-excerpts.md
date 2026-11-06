---
'@shopify/app': patch
'@shopify/cli': patch
---

`app security` results files now store the redacted lines of code that each finding cites, which `record` reads from the files `check` scans, and `check` fails instead of writing results larger than 5 MB.
