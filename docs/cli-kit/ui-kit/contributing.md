# Contributing to UI Kit

## What is UI Kit

UI Kit is a library that can be used to either ask for input from the user or render output to the terminal.
By using UI Kit you're making sure that whatever you're rendering in the terminal will follow our design system.
This ensures familiar-feeling interaction patterns for the users and allows you to benefit from design improvements without
having to change your code too often.

At its core, UI Kit is built with [ink](https://github.com/vadimdemedes/ink) which uses React under the hood.
If you're familiar with React already that's great! This guide will only cover details that are specific to UI kit,
so an understanding of [React](https://reactjs.org/docs/getting-started.html) is a prerequiste if you wish to contribute to its components library.

## Principles

UI Kit defines all its available functions inside the `public/node/ui.tsx` file.
These functions take simple JavaScript objects as params and output something to the terminal, be it a prompt or a banner.
We chose this API design so that you wouldn't have to worry about the underlying React implementation when implementing commands,
and could focus on simple data structures to pass in to these `render` functions. This will also make it easier for us to
restructure and upgrade the underlying React components without causing API breakage.

The public functions have all been documented via comments above the function themselves.
These comments include some examples of what the command would output if invoked.

## Adding a new `render` function

If none of the availble functions does what you want, you might want to add a new function to the list,
but before doing that please consider:

1. Can I extend what is already implemented with new functionality?
2. Is what I want to add a pattern that fits with the design system?

### Extending what is already there

Imagine for example that you want to create a multi-select prompt and the current `renderSelectPrompt` function only allows
the user to select one item. Should we create a new `renderMultiSelectPrompt` or pass a new `multiple` argument to the existing
`renderSelectPrompt`? The answer to this question will depend a lot on how different these two components will be and we'll
leave this decision to you, but it's still important to consider just passing a new parameter as it will allow you to
reuse a lot of the features that come with the existing components without having to reimplement them from scratch.

### Creating something in line with the design system

Another scenario we can imagine is wanting to add a component that will output a series of async tasks in a tree-like
view, similar to what [listr2](https://github.com/cenk1cenk2/listr2) does. The current `renderTasks` function takes a more calm
approach, choosing to display only the currently running task without showing any of the writes of this task to `stdout`.
This was done on purpose so that the interface would flicker less and be visually more calm, much like how the Apple starting interface
looks compared to Ubuntu's, with all the logs printed out raw at the start. In this case then the `listr2` UI wouldn't fit very well with the design approach we've taken. If you're unsure if what you're going to build will fit the current design system
feel free to reach out to the @shopify/cli-foundations team for guidance.

### Ok ok, but I still want to add a new function

Let's do it! The most important thing when adding a new function is thinking about the params it will take.

First rule is that **public functions take only one param** and that param is an object, even if it has only one key.
This will make it easier in the future to change the signatures of these functions without creating breaking changes.

Second rule is that **public functions should render only one component**. What happens most of the time is that for one new
`render` function there is a corresponding new component in the `components` directory, but this is not always the case.
For example for `renderConfirmationPrompt` and `renderSelectPrompt`. `renderConfirmationPrompt` is simply sugar on top of
`renderSelectPrompt`, but the use case is so widely used that it was worth creating a new public function just for that.

---

Ok you've though about the params and you've created your corresponding component. What now? Now you need to choose between
using two different render functions, `render` and `renderOnce`, both exposed by the private `ui` module.

The difference is that **`render` will return a promise that can be awaited**. This is useful for components that need to stay
on the screen until something happens. For example a prompt will be rendered until the user has made a selection or
long-running async tasks will render until their completion.

**`renderOnce` instead will render something to the terminal and immediately quit**.
Only the first frame will be displayed so don't use this with components that have internal state that will change.

Practically speaking `renderOnce` can be thought of as a pure function that given certain parameters will always output
the same thing to the terminal. It allows us to reuse the React components we've created for their UI,
but without the reactive part of React. As an example, banners are being rendered with `renderOnce`.

## Adding a new component

- Added a new public function ✅
- Defined the params interface ✅
- Chose between `render` and `renderOnce` ✅

It's time to add a new component! Components are built with `ink` so please go to [their readme](https://github.com/vadimdemedes/ink) if you need documentation on the components it exposes. If you know React things will work as you'd expect.
The main differece with using React on the web is that (obviously) we don't have access to the dom or CSS for styling.
Ink instead uses [yoga](https://github.com/facebook/yoga) under the hood for its layout system, which will give you access to [most](https://github.com/vadimdemedes/ink/pull/479)
of the flexbox system properties you've used for the web.

### Text vs Box

Wrapping Text with `<>` fragments and text wrapping.
Box cannot be inside `Text`

### Handling user input

`handleCtrlC` and `exitOnCtrlC`

### Components that deal with async functions

useAsyncAndUnmount

### Layout system

3 columns.
Most of the time it's preferrable to use 2 columns.
`useLayout`

## Testing components

`sendInputAndWaitForChange`, etc...

### My tests are passing locally but not on CI!

`getLastFrameAfterUnmount`

## Testing outside of components

What about testing my commands that use `render` functions?
For commands that use `renderOnce` you can use the already existing `mockOutput` and choose the corresponding property
(`error`, `info`, etc...) to check.
For commands that use `render` the testing story is not great at the moment, but we're working on it.
The problem is that we don't want to output things to the terminal during tests, but we still want a way to capture this
output in a separate stream that we can then check.
Ideally the `render` function that `ink` uses under the hood should be injectable from the outside so that for tests we
can swap it for something that will render to a fake `stoud`. We'd then be able to get this fake stream's frames
and compare them with our expectations. WIP...
