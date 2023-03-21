# Performance

Good performance significantly contributes to a good CLI experience; therefore, we should be mindful of it when contributing code to the project. This page documents how to benchmark the CLI using built-in Node functionality and provides principles to ensure we release functionality with sensible performance numbers.

## How to benchmark the CLI performance

Node can profile and output the time the runtime expects in various tasks (e.g., loading modules or running a function).
You must run Node passing the `--cpu-prof` flag to do so. Node outputs a `.cpuprofile` file in the working directory. If you run the CLI through the `shopify` script in the root `package.json` you can adjust the invocation to `node` to include the flag and run the CLI.
If you are only interested in profiling the static ESM module graph loading, you can adjust the command you are running to do an early return.


Once you've got the `.cpuprofile` file, we recommend opening it using [speedscope.app](https://speedscope.app).
The visual representation might feel intimidating when you first open it, so we recommend changing the view to "Left Heavy" to make it easier to parse. The view will sort from left to right the tasks depending on the time they take. Hovering on each of them will reveal useful context about the task.

We **strongly recommend** reading [this series of blog posts](https://marvinh.dev/blog/speeding-up-javascript-ecosystem/) on debugging to get more familiar with the process.

## Principles

### Dependencies will most likely have a cost

When NPM dependencies are used in SPAs, they are tree-shaked through bundling tools like ESBuild, Webpack, or Rollup. Because of it, many of them are designed with the implicit assumption that they'll be tree-shaked and export a single module (e.g., index.js) that loads the entire graph, **including the modules you are not using**. We could have a similar tooling in the CLI project, but we decided to keep the tooling stack as lean as possible and thus prevent issues that might arise due to the tooling indirection (e.g., invalid source maps or code that don't map 1-to-1 to the source and complicates debugging). Therefore we recommend that:

- You avoid dependencies unless they are strictly necessary. Bring it up to the team in case of doubt.
- When deciding on a dependency, their interface must be modular (many exports over a single one). In other words, avoid monolith dependencies. It's also essential that the dependency is ESM. Even though [there's a current limitation](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-2/) in Node that yields worse performance than CJS, once the issue is addressed, it should yield better performance than CJS due to the concurrent loading of the graph nodes.
- Consider contributing improvements to the dependencies:
  - Migrate them to ESM if they are still using CJS
  - Break down the monolith exports
  - Fix identified performance bottlenecks.
- As a **last resource**, if a dependency is a bottleneck you can use its CJS version or dynamically import it when needed using `await import("my-dependency")`.

### Use concurrency whenever possible

When writing code as a sequence of statements, some of which are `awaited` because we are invoking `async` functions, we might end up with logic whose performance has a lot of room for improvement. Take the following example:

```js
async function slowFunction() {
    await firstSlowFunction()
    await secondSlowFunction()
}
```

Since both functions don't depend on each other, we are not using the runtime most efficiently. Instead, consider running them concurrently with the help of the `Promise.all` API:

```js
async function slowFunction() {
    await Promise.all([
        firstSlowFunction(),
        secondSlowFunction()
    ])
}
```

The scenarios you'll come across in the project won't be as obvious as the above, where one step is right next to the other, so the profiling described above will help identify the improvement opportunities.

