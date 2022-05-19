---
title: ui
---

The `ui` modules provide utilities to prompt the user for information via terminal.


### `prompt`

prompt takes an array of `Question` that will be asked to the user sequentially and returns an object with the answers.

```ts
import {ui} from "@shopify/cli-kit"

const input: ui.Question = {
  type: 'input',
  name: 'template',
  message: 'Your app’s name? (You can change it later.)',
  default: 'my-app',
  validate: (value) => value.length > 30 ? 'App name is too long (maximum is 30 characters)' : true,
}

const select: ui.Question = {
  type: 'select',
  name: 'extensionType',
  message: 'What type of script would you like to build? (Select with ↑ ↓ ⏎)',
  default: 'extension',
  choices: ['1. Discount', '2. Payment method', '3. Shipping method'],
}

interface ResponseType = {
  template: string,
  extensionType: string
}

const result: ResponseType = await ui.prompt([input, select])
console.log(result)
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `questions` | The array of questions to ask the user | Yes | |

```ts
export interface Question {
  type: 'input' | 'select' | 'autocomplete' | 'password'
  name: string // This is the identifier that will be returned with the user answer.
  message: string
  validate?: (value: string) => string | boolean
  default?: string
  choices?: string[]
  result?: (value: string) => string | boolean // Format the final submitted value before it is returned.
}
```
:::info Question properties
`default` only affects Input types as the default answer |
`choices` only affects Select types as the array of options.
:::

:::tip Validation
If a `validate` function is provided, it may return a boolean or a string. If a string is returned it will be used as the validation error message.
:::

#### Output

It returns an object with the answers provided by the user. The return type of the function is typed depending on the expected result:
`const result: T` -> `Promise<T>`

### `promptForNonEmptyDirectory`

Used to ask users if they would like to remove the contents of a given directory before proceeding.

```ts
  await ui.nonEmptyDirectoryPrompt('path/to/non-empty-directory')
```

The following choices are presented to the user:

- Yes, remove the files
- No, abort the command
