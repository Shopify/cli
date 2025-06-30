---
'@shopify/theme': patch
---

Improvement and fixes when handling multi-environment commands

- Fixes a bug where passing a single environment to multi-env commands would cause it to fail if the environment didn't have all of the required attributes for multi-env
- Updates output when running multi-env commands to ensure the results from each command don't overlap one another
