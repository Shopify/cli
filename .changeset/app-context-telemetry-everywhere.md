---
'@shopify/cli-kit': patch
'@shopify/app': patch
---

Command analytics now opportunistically capture app context (`api_key` and `project_type`) for **every** command — not just commands that load an app. When the user is already authenticated and runs a command inside an app project, the public metadata hook reads the app from disk (no network, no prompts) and attaches those fields. It does nothing for users who aren't logged in, never triggers a login, and is bounded by a short timeout so it can't delay command exit.

Adds `sessionExists()` to `@shopify/cli-kit/node/session`: a passive, non-interactive check for whether local credentials exist (no prompt, no network).
