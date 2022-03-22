---
title: checksum
---

The `checksum` module provides utilities for validating [checksums](https://en.wikipedia.org/wiki/Checksum).

### `validateMD5`

This function takes the path to a local file, and a URL to a remote file containing the MD5 checksum of the file,
and validates it.

```ts
import { checksum } from "@shopify/cli-kit"

await validateMD5({ file: "path/to/file", md5FileURL: "https://shopify.com/file.md5" })
```

#### Input

The function takes an options object with the following attributes:

| Name | Description | Required | Default |
| --- | --- |---- | --- |
| `file` | The path to a local file | Yes | |
| `md5FileURL` | URL to a remote file containing the MD5 checksum | Yes | |

#### Output

It returns a promise that resolves with no value if the validation is successful,
or rejects with the `InvalidChecksumError` error if the checksums don't match.
