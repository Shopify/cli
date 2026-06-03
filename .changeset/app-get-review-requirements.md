---
'@shopify/app': minor
'@shopify/cli-kit': patch
---

Add `shopify app get-review-requirements`, a new command that prints the [App Store review requirements](https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements), with agent verification guidance, as markdown. Designed to be invoked by the `/shopify-app-review` agent skill in the Shopify AI Toolkit to power a local pre-submission compliance check against an app's codebase.
