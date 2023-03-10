## Table of Contents

- [What is UI Kit](#what-is-ui-kit)
- [Principles](#principles)
- [API](#api)
  - [Static output](#static-output)
  - [Prompts](#prompts)
  - [Async tasks](#async-tasks)
  - [Errors](#errors)

# Using UI Kit

## What is UI Kit

UI Kit is a library that can be used to either ask for input from the user or render output to the terminal.
By using UI Kit you're making sure that whatever you're rendering in the terminal
will be consistent with the rest of the output.
This ensures familiar-feeling interaction patterns for the users and allows you to benefit from design improvements without
having to change your code too often.

## Principles

UI Kit defines all its available functions inside the `public/node/ui.tsx` file.
These functions take simple JavaScript objects as params and output something to the terminal, be it a prompt or a banner.
We chose this API design so that you wouldn't have to worry about the underlying React implementation when implementing commands,
and could focus on simple data structures to pass into these `render` functions. This will also make it easier for us to
restructure and upgrade the underlying React components without causing API breakage.

## API

The public interface can be roughly divided in three categories that answer different needs:

- Output some static output to the user, be it some useful information, an error, or a success message
- Ask the user for input
- Display progress of asynchronous tasks

### Static output

> Run `shopify kitchen-sink static` to see some examples



### Prompts

> Run `shopify kitchen-sink prompts` to see some examples

### Async tasks

> Run `shopify kitchen-sink async` to see some examples


### Errors

If you're using the `cli-kit`'s `runCLI` function to wrap your CLI, you can throw `AbortError` and let the runner display the exception properly. More on what `AbortError` accepts [here](../errors.md#aborting-the-execution-using-errors).

If you're using your own custom errors or you're not using `runCLI` then you can use the `renderFatalError` function.
Make sure that your error extends the `cli-kit` class `FatalError` (`AbortError` already does) and pass it to `renderFatalError`
when you want to display it to the terminal, for example in your exception handler.
