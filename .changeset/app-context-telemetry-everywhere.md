---
'@shopify/cli-kit': patch
'@shopify/app': patch
---

Command analytics now opportunistically capture app context (`api_key`, `project_type`, and the `app_*` / `cmd_app_*` fields) for **every** command — not just commands that load an app. When the user is already authenticated and runs a command inside an app project, the public metadata hook reads the app from disk (no network, no prompts) and attaches those fields. Commands run **outside** any app directory replay the full context of the most-recently-used app, so app context is still captured even when the working directory isn't an app root (e.g. running from a parent folder).

A new `cmd_app_context_source` field records how the context was resolved: `"current_directory"` when loaded from the command's working directory, or `"last_used"` when replayed from the most-recently-used app. It does nothing for users who aren't logged in, never triggers a login, and is bounded by a short timeout so it can't delay command exit.

Adds `sessionExists()` to `@shopify/cli-kit/node/session`: a passive, non-interactive check for whether local credentials exist (no prompt, no network).
