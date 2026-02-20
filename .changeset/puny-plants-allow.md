---
'@shopify/cli-kit': minor
'@shopify/theme': minor
'@shopify/cli': minor
---

Add `--development-context` flag to `theme push`

The new `--development-context` flag (short: `-c`) allows you to specify a unique identifier for a development theme context (e.g., PR number, branch name). This gives developers the ability to programmatically create or reuse named development themes; particularly useful when running `shopify theme push` in a CI environment where you might want to associate a particular development theme to a branch or pull request.
