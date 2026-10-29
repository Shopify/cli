---
'@shopify/cli-kit': patch
---

Reuse cached notifications for an hour instead of starting a background process to fetch them after every command, which made each command use about twice the CPU
