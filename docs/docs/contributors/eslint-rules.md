---
title: ESLint rules
---

To ensure the contributions to the project follow the conventions,
the project leverages [ESLint](https://eslint.org/) with third-party and local rules.
This page contains a list of all the local rules alongside the convention they enforce.

### `command-flags-with-env`

This rule ensures that command flags have the environment variable set.
This way users can decide between passing flags using arguments or environment variables:

```bash
shopify app scaffold ui-extension --type product-subscription

# vs

SHOPIFY_FLAG_TYPE=product-subscription shopify app scaffold ui-extension
```
