---
'@shopify/cli-kit': patch
'@shopify/app': patch
---

Command analytics now associate app-level identifiers with **every** command run inside an app project — not just commands that load an app. When the user is already authenticated and the working directory is at or below an app root, the public metadata hook reads the app from disk (no network, no prompts) so the command is attributed to that app just as a `shopify app …` command would be.

It does nothing for users who aren't logged in, never triggers a login, and is bounded by a short timeout so it can't delay command exit.

Adds `sessionExists()` to `@shopify/cli-kit/node/session`: a passive, non-interactive check for whether local credentials exist (no prompt, no network).
