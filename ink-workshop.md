# Useful resources

* [Ink documentation](https://github.com/vadimdemedes/ink/blob/master/readme.md)
* [React Hooks](https://reactjs.org/docs/hooks-reference.html)

---

# Basic concepts

`renderOnce`

This method will be useful when you want to render something statically only once (e.g. our banners)


`render`

This is the method to call when you want to leverage the reactive nature of ink. If you have any component with some state and multiple rendering cycles this is what you should use. It returns a promise that can be awaited and will resolve when Ink unmounts its instance.

---

When calling one of the two methods above, Ink will mount an React instance, render the component passed as an argument and unmount itself if there are no running processes inside of it. For example if you use `setInterval` inside `useEffect`, rendering will continue until your clear it or an error is thrown.

---

# Things to keep in mind

If you want to preserve the output that Ink produces after it unmounts you have to use the `<Static>` [component](https://github.com/vadimdemedes/ink#static). This is useful for cases when you can't know or control the amount of items that need to be rendered.

Your layout system if flexbox. That said not every property defined in the flexbox specification is available, for example `flexWrap`. The list of supported properties of the `Box` component is available on the [main Ink readme](https://github.com/vadimdemedes/ink#box).

---

Hystory will be cleared if the height of the component rendered is more than the height of the terminal. The reason is that it wouldn't be possible to render the lines above the fold correctly otherwise.

---

# Hooks

`useInput`

Used for handling user input. It's a more convenient alternative to using useStdin and listening to data events. The callback you pass to useInput is called for each character when user enters any input.

`useApp`

Exposes a method to manually exit the app (unmount). Useful in try/catch blocks when you don't want to throw and instead exit gracefully.

---

`useStdout`

Exposes the stdout stream where Ink renders components. Useful if you want to know how wide the user terminal is with `stdout.columns`.

---

# Useful components

`FullScreen`

You can use this component if you want to render your component full screen and have it re-render on screen resizes. Also, because it renders its children in a separate buffer, it will preserve terminal history when exiting with ctrl+c.

`TextAnimation`

This is a wrapper around [chalk-animation](https://github.com/bokub/chalk-animation) which provides some basic text animations.

---

# Testing

You can get an idea of how to test components in [this WIP PR](https://github.com/Shopify/cli/pull/797)

Testing components that call `render` instead of `renderOnce` will be more complicated as there will be multiple frames to check. Also Ink will only render the last frame in the CI environments so there might be issues if you're trying to check an intermediate frame.

---

# Component ideas

- A generic progress indicator (e.g. a spinner, a character that bounces back and forth, etc.)
- Markdown processor
- Syntax highlighter
- Progress bar with percentage
- Task list - A basic replacement for listr, where if you have some tasks and sub tasks we report their status until completion
- Tic-tac-toe
- A quick search text input
