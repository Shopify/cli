---
title: output
---

The module `output` provides a set of utilities for presenting information to the user.
The API builds upon [tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) to tokenize the content and apply different formatting depending on the semantics of the tokens.
The example below shows how we are using tagged templates to mark the directory where the app has been created as a `path` token:

```ts
import { output } from "@shopify/cli-kit"

const content = output.content`App successfully created at ${output.token.path("/path/to/the/app")}`
```

The following **tokens** are supported:

- `path`: To represent paths to files and directories.
- `command`: To represent a shell command.


