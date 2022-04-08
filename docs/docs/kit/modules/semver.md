---
title: semver
---

The `semver` provides utilities for working with [Semantic Versions](https://semver.org/).


### `Version`

If you have a `string` representing a semantic version, you can create an instance of `Version` with it. The `Version` class provides convenient accessors to read the various components of the version and compare it with other versions.

```ts
import { semver } from "@shopify/cli-kit"

// Valid version
const versionString = "1.2.3"
const version = new semver.Version(versionString)
console.log(version.minor) // 2

// Invalid version
new semver.Version("invalid") // raises semver.InvalidVersionError
```

