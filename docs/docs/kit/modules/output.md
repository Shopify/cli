---
title: output
---

The module `output` provides a set of utilities for presenting information to the user.

:::caution `console.log`
Refrain from using the `console` APIs as the ESLint setup suggests. The interfacing through the `output` module allows achieving consistent formatting and capturing the output in tests to run expectations on it.
:::

## API

### `content`

The output module API builds upon [tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) to tokenize the content and apply different formatting depending on the semantics of the tokens.
The example below shows how we are using tagged templates to mark the directory where the app has been created as a `path` token:

```ts
import { output } from "@shopify/cli-kit"

const content = output.content`App successfully created at ${output.token.path("/path/to/the/app")}`
```

The following **tokens** are supported:

- `path`: To represent paths to files and directories.
- `command`: To represent a shell command.
- `link`: To represent a URL - `output.token.link("Shopify", "https://shopify.com")`


### `output.info`

To output information to the user, you can use the `output.info` interface.
The content is sent through the standard output without additional formatting.

```ts
import { output } from "@shopify/cli-kit"

output.info("Starting the HTTP server...")
```

:::info console.log
`output.info` supersedes the well-known `console.log`.
:::

### `output.success`

To output information that represents the success of an operation, for example when the app has finished building, you can use the `output.success` interface.
The content is sent through the standard output with special formatting to represent success.


```ts
import { output } from "@shopify/cli-kit"

output.info("The app has built successfully.")
```

### `output.debug`

To output debug information that's not presented by default unless the user indicates so with the `--verbose` flag, you can use the `output.debug` interface.
The content is sent through the standard output with no special formatting.

```ts
import { output } from "@shopify/cli-kit"

output.debug("Sending GraphQL mutation to the partners API: updateApp")
```

### `output.warn`

To output information that represents a warning, you can use the `output.warn` interface.
The content is sent through the standard output with special formatting.

```ts
import { output } from "@shopify/cli-kit"

output.warn("The 'name' attribute is deprecated and will soon be removed.")
```

### `output.newline`

If you need to output a new line, you can use the `output.newline()` interface.

## Testing

Because mocking the output and running expectations on the content that we output to the user is a common need when writing tests, we provide a utility from `@shopify/cli-testing` to facilitate writing those tests:

```ts
import {it, expect} from 'vitest'
import {outputMocker} from '@shopify/cli-testing'
import {output} from '@shopify/cli-kit'

it('output', () => {
  // Given
  const outputMock = outputMocker.mockAndCapture()

  // When
  output.info('Hello world')

  // Then
  expect(outputMock.output()).toMatch(/Hello world/)
  outputMock.clear()
})
```

You can either call `output()` to get the aggregated output or `info()`, `debug()`, `success()`, `warn()` to get the individual output. The collected output is the raw content that is passed to the APIs.

:::caution Clearing the mock
The mocking doesn't get cleared automatically and therefore it's important that you call `clear()` on the mock object.
:::
