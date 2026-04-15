---
'@shopify/app': patch
---

Avoid spurious config prompts:
- Skip TOML selection prompt when using --reset flag
- Use default shopify.app.toml without prompting when running `config link --client-id` with no existing TOML files
