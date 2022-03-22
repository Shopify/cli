---
title: os
---

The `os` module from `@shopify/cli-kit` provides utilities for reading information and interacting with the operative system in which the CLI is running:

### `username`

If you need to get the current user, you can call the following function:

```ts
import { os } from "@shopify/cli-kit"

const username = await os.username();
```

### `platformAndArch`

The function returns the platform and the architecture of the environment in which the Node process is running:

```ts
import { os } from "@shopify/cli-kit"

const {platform, arch} = os.platformAndArch();
console.log(platform) // darwin
console.log(arch) // arm64
```
