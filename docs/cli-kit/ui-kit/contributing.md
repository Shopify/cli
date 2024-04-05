# Contributing to UI Kit

## Table of Contents

- [Contributing to UI Kit](#contributing-to-ui-kit)
  - [Table of Contents](#table-of-contents)
  - [Intro](#intro)
  - [Adding a new `render` function](#adding-a-new-render-function)
    - [Extending what is already there](#extending-what-is-already-there)
    - [Creating something in line with the design system](#creating-something-in-line-with-the-design-system)
    - [Ok ok, but I still want to add a new function](#ok-ok-but-i-still-want-to-add-a-new-function)
  - [Adding a new component](#adding-a-new-component)
  - [Components overview](#components-overview)
    - [`Text` vs `Box`](#text-vs-box)
    - [Utility components](#utility-components)
      - [`TokenizedText`](#tokenizedtext)
      - [`TextAnimation`](#textanimation)
  - [Helpful tips](#helpful-tips)
    - [Handling user input](#handling-user-input)
    - [Components that deal with async functions](#components-that-deal-with-async-functions)
    - [Layout system](#layout-system)
  - [Testing components](#testing-components)
  - [Troubleshooting](#troubleshooting)
    - [My tests are passing locally but not on CI!](#my-tests-are-passing-locally-but-not-on-ci)
  - [Testing outside of components](#testing-outside-of-components)

## Intro

At its core, UI Kit is built with [Ink](https://github.com/vadimdemedes/ink) which uses React under the hood.
If you're familiar with React already that's great! This guide will only cover details that are specific to UI kit,
so an understanding of [React](https://reactjs.org/docs/getting-started.html) is a prerequisite if you wish to contribute to its components library.

## Adding a new `render` function

If none of the available functions does what you want, you might want to add a new function to the list,
but before doing that please consider:

1. Can I extend what is already implemented without introducing breaking changes?
2. Is what I want to add a pattern that fits with the rest of the existing components?

### Extending what is already there

Imagine for example that you want to create a multi-select prompt and the current `renderSelectPrompt` function only allows
the user to select one item. Should we create a new `renderMultiSelectPrompt` or pass a new `multiple` argument to the existing
`renderSelectPrompt`? The answer to this question will depend a lot on how different these two components will be and we'll
leave this decision to you, but it's still important to consider just passing a new parameter as it will allow you to
reuse a lot of the features that come with the existing components without having to reimplement them from scratch.

It's also important to keep in mind that changes should be backwards compatible. This means that, for example, we shouldn't
remove functions from the public `ui.tsx` file and that we should only be adding attributes to the params interfaces,
without changing the type definition of the existing ones. If we wish to introduce a breaking change we should deprecate
the functionality first and then remove it only in a major version bump.

### Creating something in line with the design system

Another scenario we can imagine is wanting to add a component that will output a series of async tasks in a tree-like
view, similar to what [listr2](https://github.com/cenk1cenk2/listr2) does. The current `renderTasks` function takes a more calm
approach, choosing to display only the currently running task without showing any of the writes of this task to `stdout`.
This was done on purpose so that the interface would flicker less and be visually more calm, much like how the Apple starting interface
looks compared to Ubuntu's, with all the logs printed out raw at the start. In this case then the `listr2` UI wouldn't fit very well with the design approach we've taken. If you're unsure if what you're going to build will fit the current design system
feel free to open an issue in the @shopify/cli repository.

### Ok ok, but I still want to add a new function

Let's do it! The most important thing when adding a new function is thinking about the params it will take.

First rule is that **public functions take only one param** and that param is an object, even if it has only one key.
This will make it easier in the future to change the signatures of these functions without creating breaking changes.

Second rule is that **public functions should render only one component**. What happens most of the time is that for one new
`render` function there is a corresponding new component in the `components` directory, but this is not always the case.
For example for `renderConfirmationPrompt` and `renderSelectPrompt`. `renderConfirmationPrompt` is simply sugar on top of
`renderSelectPrompt`, but the use case is so widely used that it was worth creating a new public function just for that.

---

Ok you've thought about the params and you've created your corresponding component. What now? Now you need to choose between
using two different render functions, `render` and `renderOnce`, both exposed by the private `ui` module.

The difference is that **`render` will return a promise that can be awaited**. This is useful for components that need to stay
on the screen until something happens. For example a prompt will be rendered until the user has made a selection or
long-running async tasks will render until their completion.

**`renderOnce` instead will render something to the terminal and immediately quit**.
Only the first frame will be displayed so don't use this with components that have internal state that will change.

Practically speaking `renderOnce` should be used for stateless components only.
It allows us to reuse the React components we've created for their UI, but without the reactive part of React.
As an example, banners are being rendered with `renderOnce`.

## Adding a new component

- Added a new public function ✅
- Defined the params interface ✅
- Chose between `render` and `renderOnce` ✅

It's time to add a new component! Components are built with Ink so please go to [their readme](https://github.com/vadimdemedes/ink) if you need documentation on the components it exposes. If you know React things will work as you'd expect.
The main difference with using React on the web is that (obviously) we don't have access to the dom or CSS for styling.
Ink instead uses [yoga](https://github.com/facebook/yoga) under the hood for its layout system, which will give you access to [most](https://github.com/vadimdemedes/ink/pull/479)
of the flexbox system properties you've used for the web.

## Components overview

### `Text` vs `Box`

**`Box`**

`Box` is the unit of Ink's flexbox system. If you need to give text or a certain group of components a flexbox property
you can wrap it with `Box`. Be aware that `Text` components cannot contain `Box` elements inside.

**`Text`**

`Text` allows you to apply styling to text, for example color or background color. Make sure that the only components nested
inside `Text` elements are only text elements or you might run in some text wrapping or styling issues.
For example, avoid putting `<>` fragments inside text as they will mess with the layout and style in unexpected ways.

If you're writing a very simple component that will transform some text, try to return a parent `Text` element only
and leave the layout responsibility to the parent component. This way it will be easier to compose your component
with others as it will be possible to embed it inside other `Text` elements. If you return something wrapped in `Box`
this will not be possible.

### Utility components

On top of what Ink provides there are a few utility components that are important to our design system.

#### `TokenizedText`

`TokenizedText` is the building block for textual components. For example links, commands, paths, lists are all rendered with `TokenizedText`. Anything simple and textual should be rendered through this component.

If you're building a component and you'd like to accept various different small tokens as an attribute, you should define
the type of the attribute as `{attribute: TokenItem}` and then include `render(<TokenizedText item={attribute} />` in your component.
This way, if a user wants to render a link inside your attribute, all they need to do is pass the link token (which is a POJO)
to your render function. For example:

```
renderExample({
  attribute: {
    link: {
      label: 'Shopify',
      url: 'https://shopify.com'
    }
  }
})
```

As a bonus, users will be able to pass arrays of these object tokens and `TokenizedText` will concatenate them with spaces.
The only exception is the `char` token which will be concatenated without spaces. This can be useful if you want to add
punctuation. For example: `['Is this going to add a space after the question', {char: '?'}, 'No.']` will result in:
`Is this going to add a space after the question? No.`.

**Inline or Block elements**

Tokens are divided in two categories: `inline` and `block`. Inline elements will be wrapped inside `Text` and will behave
like `span` elements in HTML. Block elements will be wrapped in a `Box` element and will behave more like `div` in HTML,
adding a line return after the block.

If you wish to force users to use inline elements with certain params, you can use the `TokenItem<InlineToken>` param.
This will forbid users of the function to pass params that contain block elements. In this case `TokenizedText`
will not use any `Box` components and will wrap everything with `Text` only.
As a result you can confidently use `TokenizedText` with such items inside `Text` elements.

**Adding a new token**

If you think that you need a new type of style (for example italics) for the text inside your components you can
add a new interface named `ItalicToken` in the `TokenizedText` and decide how it's going to be rendered, inline or block.
In this example we would use `inline`. But before you go ahead and add a new token, consider if all the users of UI kit
might need this new token or not. If the answer is no, then a simple regular component will suffice.

#### `TextAnimation`

At the moment this component simply animates text with a rainbow effect, however it can be extended to support more animations.
If you wish to do so you can take a look at how [chalk-animation](https://github.com/bokub/chalk-animation/blob/master/index.js)
implemented animations and take inspiration from there.

## Helpful tips

### Handling user input

For input you can use Ink's `useInput` callback. One thing to note is that, because using `useInput`
will set the standard input to raw mode, if you will have to pass `exitOnCtrlC: false` to the `render` function so that
Ink won't handle the Ctrl+C input and instead leave that to you. This flag should be used in conjunction with the
`handleCtrlC` utility function that will handle the `Ctrl+C` input for you.

### Components that deal with async functions

React doesn't really allow you to call async functions inside the body of a component as `render` should be pure and all side effects
should be wrapped in `useEffect`. Because it's very common to pass async functions to components we've added a `useAsyncAndUnmount` hook that will execute your function in a `useEffect` hook and appropriately
unmount Ink if the function resolves or rejects. From the outside, using this hook will make sure that in case of errors `render`
will first clean up Ink's rendering instance and then will reject with the error that the function rejected with.

### Layout system

One of the great things about using Ink is that the output will try to adapt to the user terminal size much like a web page
will try to adapt the user browser window size.

Still, to make it easier to create components that visually align together, we've added a layout system made of three columns.
You can call `useLayout` and access these three columns to use as you wish, bearing in mind that most components will
render taking 2 columns with a few exceptions.

## Testing components

For every component please try to add a corresponding `.test.tsx` file. Depending on what you're component does you can then
test how it behaves with input and what kind of output it produces.

**Output**

For output you can use the `render` function defined in `private/testing/ui.ts` which will return a `lastFrame` function that can be called to get
the last frame rendered by Ink. This, in conjunction with `vitest`'s `toMatchInlineSnapshot` should be sufficient.
If you want to wait for a component to finish rendering before checking the last frame, you can await the return value of `waitUntilExit` which is a property of the instance returned by the `render` method.

**Input**

After you've rendered a component in a test it won't be ready to accept inputs immediately. This is a known shortcoming of
Ink that the author is aware of. Lacking a callback or a promise we can await we've added a `waitForInputsToBeReady`
function that can be awaited and will make sure that the component is ready to accept input.

Input can be sent by writing to the `stdin` of the instance returned by `render`, as so

```
renderInstance.stdin.write("a")
```

You typically will want to wait for some change to happen in the component after input has been sent.
For that we've added a bunch of helper functions to help you test inputs inside `src/private/node/testing/ui.ts`.
Every function is documented with a comment above so check out that file to know more about them.

## Troubleshooting

### My tests are passing locally but not on CI!

Ink behaves [differently in CI](https://github.com/vadimdemedes/ink/pull/266). Apart from forking the project or contributing
by adding an extra flag to override that behavior (something the maintainer doesn't like), there isn't a way to prevent that.
For that reason we've added a `getLastFrameAfterUnmount` function that should be used only after the component being rendered
has been unmounted. This function will make sure that no matter the environment the last frame will be consistent.

## Testing outside of components

For commands that use `renderOnce` you can use the already existing `mockOutput` and choose the corresponding property
(`error`, `info`, etc...) to check.

For commands that use `render` the testing story is not great at the moment, but we're working on it.
The problem is that we don't want to output things to the terminal during tests, but we still want a way to capture this
output in a separate stream that we can then check.
Ideally, the Ink `render` function that our `render` functions use under the hood should be injectable from the outside
so that for tests we can swap it for something that will render to a fake `stdout`.
We'd then be able to get this fake stream's frames and compare them with our expectations. This is still WIP.
