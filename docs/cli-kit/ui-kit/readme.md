## Table of Contents

- [What's the CLI UI Kit?](#whats-the-cli-ui-kit)
- [Principles](#principles)
- [API](#api)
  - [Static output](#static-output)
    - [`renderInfo` / `renderWarning` / `renderSuccess`](#renderinfo--renderwarning--rendersuccess)
    - [Errors](#errors)
    - [`renderText`](#rendertext)
  - [Prompts](#prompts)
    - [`renderSelectPrompt`](#renderselectprompt)
    - [`renderConfirmationPrompt`](#renderconfirmationprompt)
    - [`renderAutocompletePrompt`](#renderautocompleteprompt)
    - [`renderTextPrompt`](#rendertextprompt)
  - [Async tasks](#async-tasks)
    - [`renderConcurrent`](#renderconcurrent)
    - [`renderTasks`](#rendertasks)

# Using the CLI UI Kit

## What's the CLI UI Kit?

UI Kit is a set of modules in the `@shopify/cli-kit` package that can be used to either ask for input from the user or render output to the terminal.
By using UI Kit you're making sure that whatever you're rendering in the terminal
will be consistent with the rest of the output and across Shopify.
This ensures familiar-feeling interaction patterns for the users and allows you to benefit from design improvements without
having to change your code too often.

## Principles

UI Kit defines all its available functions inside the `public/node/ui.tsx` file.
These functions take simple JavaScript objects as params and output something to the terminal, be it a prompt or a banner.
We chose this API design so that you wouldn't have to worry about the underlying React implementation when implementing commands,
and could focus on simple data structures to pass into these `render` functions. This will also make it easier for us to
restructure and upgrade the underlying React components without causing API breakage.

All public functions have been documented via comments above the function themselves. If you want to see some examples of their output you can check them out.

## API

The public interface can be roughly divided in three categories that answer different needs:

- Static output
- Prompts
- Async tasks

Static output gets printed only once and is backed by stateless components. Functions that render static output are not promises and you can call them in succession without awaiting them.

Prompts and async tasks, on the other hand, return promises that must be awaited. You cannot call two of these in succession without awaiting as this will instantiate two React rendering instances behind the scenes and create rendering conflicts.

### Static output

> Run `shopify kitchen-sink static` to see some examples

Static output is usually displayed in the form of banners with appropriate titles and border colors.

#### `renderInfo` / `renderWarning` / `renderSuccess`

All these functions take the same params. What changes are the color and the title of the box in the output. None of the params is required so you can choose to compose your banners however you prefer. Most banners will need a `headline`, which will be highlighted in **bold**, and a body containing some details. Check out the `simple` and `complete` examples above those functions to see how they can be used.

Some default sections like `nextSteps`, `reference` and `link` are provided and should be used whenever possible, but if none of these suit your needs you can pass a `customSections` param which allows you to customize the title of the sections.

All banners (including errors) are rendered with a width of 2/3 of the full width, unless the terminal is less than a certain minimum size, in which case they take the full width.

#### Errors

If you're using the `cli-kit`'s `runCLI` function to wrap your CLI, you can throw `AbortError` and let the runner display the exception properly. More on what `AbortError` accepts [here](../errors.md#aborting-the-execution-using-errors).

If you're using your own custom errors or you're not using `runCLI` then you can use the `renderFatalError` function.
Make sure that your error extends the `cli-kit` class `FatalError` (`AbortError` already does) and pass it to `renderFatalError`
when you want to display it to the terminal, for example in your exception handler.

#### `renderText`

This function is very simple, it accepts a string and it prints it in the terminal while respecting the design system spacing rules. Try to use it instead of `console.log` so that all output is properly aligned.

### Prompts

> Run `shopify kitchen-sink prompts` to see some examples

Prompts interrupt the flow of commands to ask the user for some information. There are two main types of prompts: selects and textual prompts. They all take a `message` property which will be displayed as the title of the prompt to the user and is usually in the form of a question. If you forget to use punctuation at the end of `message` we'll add `?` for you.

For select prompts, if the terminal is not tall enough to render all the options the prompt will resize to fit the terminal window and a message will appear warning the user that only a fraction of the items is being displayed. The user can then cycle through the items, including the hidden ones, by using the arrow keys.

#### `renderSelectPrompt`

This is an async function that will resolve with the value selected by the user. `choices` need to be passed as an array of `Item` which is defined as:

```ts
export interface Item<T> {
  label: string
  value: T
  key?: string
  group?: string
}
```

As you can tell from the interface, select prompts support grouping and shortcut keys (the `key` attribute) that can be used to jump straight to the item. Because keys can be made of multiple characters, the input is debounced slightly so that we can keep capturing keys pressed fast enough and chain them before we select the appropriate item.

Once the user presses either `Enter` or a shortcut (if `submitWithShortcuts` is `true`) the function will resolve with the value of the `value` key.

If you need to add some more context to help the user make a decision you can pass an `infoTable` to show to the user right below the question.

If you want to have an item other than the first selected when the prompt initially renders, you can pass a `defaultValue` argument as well.

#### `renderConfirmationPrompt`

A simplified version of `renderSelectPrompt` where there are only two options and they can be selected immediately by pressing `y` or `n` to confirm or cancel. You can customize the confirmation and cancellation messages with `confirmationMessage` and `cancellationMessage`.

#### `renderAutocompletePrompt`

Very similar to `renderSelectPrompt` with the difference that you can provide a `search` function which takes the input of a text field rendered next to the prompt and should return an array of items, with a fixed length limit. If there are more pages to show you can pass the `hasMorePages` param to tell the user that there are more items to display if they keep refining their search term.

#### `renderTextPrompt`

Shows a text field and waits for the user to input something and press `Enter` to submit.

Unless `allowEmpty` is set to `true` the user will see a validation error if they attempt to press `Enter` without having typed anything. If `allowEmpty` is `true` then an empty string will be returned in case they immediately press `Enter`. This can be useful for optional fields.

`defaultValue` can be used to show a default value with a dimmed text style. The user can either press `Enter` immediately if they wish to submit the default value or start typing in order to override it.

The validation logic can also be customized by passing the `validate` function which has to return either a `string` in case of error or `undefined` in case validation passes.

Finally, if you want to mask the user input with asterisks you can set the `password` param to `true`. This can be useful for sensitive inputs that the user might not want to reveal while typing.

### Async tasks

> Run `shopify kitchen-sink async` to see some examples

Depending on whether you want to show the logs of asynchronous functions or not you can use `renderConcurrent` or `renderTasks` respectively.

#### `renderConcurrent`

Runs `processes` in parallel and displays their logs with timestamps. If you want to hide the timestamps you can pass `showTimestamps: false`.

It's also possible to show a footer at the end of the logs that will stick to the bottom of the terminal while the logs keep running. In this footer you can include the description of shortcuts, but the actual implementation of these `shortcuts` needs to be passed as the `onInput` callback.

#### `renderTasks`

The only param is an array of `Task`s that will be run in sequence.
Each task carries forward a Context (`ctx`) that is the first param of the `task` async function and that can be used to store some data to be consumed by the succeeding tasks.

You can also `skip` tasks and `retry` them up to a `retryCount` limit. If the task fails more times than `retryCount` it will contain an `errors` property filled with all the errors collected during retries. You can inspect this property when handling the rejection for the `renderTask` promise, for example:

```ts
const task = {
  title: 'test',
  retry: 3,
  task: async (_ctx, task) => {
    if (task.retryCount <= task.retry) {
      throw new Error(`something went wrong${task.retryCount}`)
    }
  },
}

try {
  await renderTasks([task])
} catch {
  console.log(task.errors.map(e => e.message).join('\n'))
  // something went wrong0
  // something went wrong1
  // something went wrong2
}
```
