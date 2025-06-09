---
"@shopify/theme": patch
"@shopify/cli-kit": patch
---

Remove git remote after cloning theme in `theme init` command to prevent accidental pushes to the skeleton theme repository
