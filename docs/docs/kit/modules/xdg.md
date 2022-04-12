---
title: xdg
---

The `xdg` module builds upon the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/) to provide utility methods to get the path to directories configured through [environment variables](https://specifications.freedesktop.org/basedir-spec/latest/ar01s03.html).


### `cacheHome`

Returns the value of the `XDG_CACHE_HOME` environment variable falling back to `~/.cache` if the variable is not present.

```ts
import { xdg, constants } from "@shopify/cli-kit"

const cacheHome = xdg.cacheHome()
const shopifyCliCache = constants.paths.directories.cache() // ~/.cache/shopify-cli
```
