---
'@shopify/cli-kit': minor
'@shopify/theme': patch
'@shopify/app': patch
---

Handle Trust Battery identity challenges in theme commands. When Shopify asks you to verify your identity, the CLI opens the verification page in your browser and continues after you complete it. In CI, with `--no-input`, or with `--json`, the command stops and prints the verification link. `app dev` stops creating its host theme when you cancel the verification or it fails, instead of trying again.
