---
'@shopify/app': patch
'@shopify/cli': patch
---

Stop `app security review` from calling deterministic-only checks passed, say how many checks still need the coding agent and how to run them, and print suggested commands' `--path` as an absolute path when the app is outside the working directory.
