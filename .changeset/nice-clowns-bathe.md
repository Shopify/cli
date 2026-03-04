---
'@shopify/cli-kit': patch
'@shopify/theme': patch
'@shopify/cli': patch
---

Change wording for current development theme in `theme list`

Previously you could only have one development theme at a time so we'd add `[yours]` beside the development theme that you were currently attached to. Now you can have multiple development themes so we're changing the language to `[current]` to show which theme you are actively connected to.
