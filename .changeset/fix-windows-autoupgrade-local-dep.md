---
'@shopify/cli-kit': patch
---

Fix Windows-only bug where `currentProcessIsGlobal()` misclassified a project-local Shopify CLI install as global, causing the auto-upgrade flow to run `npm install -g @shopify/cli@latest` after every command on Windows. The path comparison now goes through `isSubpath` (pathe-based) so backslash-separated `argv[1]` and forward-slash `projectDir` compare correctly. macOS and Linux were unaffected.
