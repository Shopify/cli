---
'@shopify/cli-kit': patch
---

Auto-upgrade now skips project-local installs when triggered by the postrun hook. Running `shopify upgrade` explicitly still upgrades the project's `package.json` / lockfile; only the silent background flow is affected, so users aren't surprised by unsolicited diffs in their app project.
