---
title: version
---

The `version` module from `@shopify/cli-kit` provides models and utilities for reading and working with versions.


### Get the latest version of an NPM package

If you need to obtain the latest version of an NPM package,
you can call the function `latestNpmPackageVersion` passing the NPM package for which you'd like to get the latest version.

```ts
import { version } from "@shopify/cli-kit"

const version = await latestNpmPackageVersion("@shopify/cli");
```
