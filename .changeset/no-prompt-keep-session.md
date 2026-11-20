---
'@shopify/cli-kit': patch
---

Stop clearing the shared session store when a non-interactive (`noPrompt`) process cannot refresh its credentials, so a background process such as `theme dev` no longer logs out every other CLI process.
