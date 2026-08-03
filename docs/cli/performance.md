# Performance

Good performance significantly contributes to a good CLI experience; therefore, we should be mindful of it when contributing code to the project. This page documents how to benchmark the CLI using built-in Node functionality and provides principles to ensure we release functionality with sensible performance numbers.

## Tracking startup cost over time

Profiling tells you where the time goes today. It doesn't tell you that a dependency added last Tuesday made every invocation 4% slower. That is what [tak](https://tak.jdx.dev) is for: it measures the CLI's startup cost on every commit that lands on `main` and keeps the history in this repository, under the git-notes ref `refs/notes/tak`. There is no dashboard, service or account behind it.

```bash
git fetch origin refs/notes/tak:refs/notes/tak
tak history
```

### Why instruction counts

tak measures **retired instruction counts** with valgrind's cachegrind, not wall time. Wall clock on a shared CI runner moves by double-digit percentages between runs, which is far larger than most regressions worth catching; a threshold tight enough to catch one would fire constantly. Instruction counts on the same commit reproduce to about 0.0003%, so a 1% change is unambiguous. tak records wall time too, but never gates on it.

This only holds because the benchmarks run Node with `--predictable`. V8 randomises its string hash seed per process, tiers functions up on a time-based budget, and marks the heap on background threads, all of which move the instruction count of a plain `node` run by around 0.2%. `--predictable` removes all three. Don't drop that flag from `tak.toml`.

### Running it locally

Requires Linux and valgrind (`apt-get install valgrind`); instruction counting is unavailable on Apple Silicon and Windows, where tak records timing only. Install the same tak version [`.github/actions/setup-tak/action.yml`](../../.github/actions/setup-tak/action.yml) pins, then:

```bash
pnpm perf           # bundle the CLI and print the numbers
pnpm perf:record    # the same, appended to your local refs/notes/tak
```

Nothing leaves your machine unless you run `tak push`, which only CI should do.

### Adding or changing a benchmark

The benchmarks are declared in [`tak.toml`](../../tak.toml), which explains what each one measures and why. Two rules matter when adding one:

- **It must be hermetic.** No network, no clock, no mutable machine state. Verify it rather than assuming it: run the command with no network (`unshare -rn`) and confirm the instruction count is unchanged. `shopify commands` failed exactly this test and was rejected.
- **It must measure the bundle.** `pnpm nx bundle cli` produces what ships to npm; the `tsc` output costs about a third more instructions for the same command, so measuring it measures a CLI nobody runs.

### What CI does with it

[`perf.yml`](../../.github/workflows/perf.yml) records the tip of every push to `main` and is the only thing that writes to the shared history. [`perf-pr.yml`](../../.github/workflows/perf-pr.yml) measures a pull request, compares it against its merge base, and posts the numbers as a sticky comment. It does not fail on a regression yet: a gate needs a baseline series, and `main` has to accumulate one first. Flip `TAK_GATE` to `'1'` in that workflow when it has.

## How to benchmark the CLI performance

Node can profile and output the time the runtime expects in various tasks (e.g., loading modules or running a function).
You must run Node passing the `--cpu-prof` flag to do so. Node outputs a `.cpuprofile` file in the working directory. If you run the CLI through the `shopify` script in the root `package.json` you can adjust the invocation to `node` to include the flag and run the CLI.

```bash
node --cpu-prof packages/cli/bin/dev.js
```

If you are only interested in profiling the static ESM module graph loading, you can adjust the command you are running to do an early return.

```ts
export default class Build extends Command {
    async run(): Promise<void> {
        // Early return
        return;
    }
}
```

Once you've got the `.cpuprofile` file, we recommend opening it using [speedscope.app](https://speedscope.app).
The visual representation might feel intimidating when you first open it, so we recommend changing the view to "Left Heavy" to make it easier to parse. The view will sort from left to right the tasks depending on the time they take. Hovering on each of them will reveal useful context about the task.

We **strongly recommend** reading [this series of blog posts](https://marvinh.dev/blog/speeding-up-javascript-ecosystem/) on debugging to get more familiar with the process.

## Principles

### Dependencies will most likely have a cost

When NPM dependencies are used in SPAs, they are tree-shaken through bundling tools like ESBuild, Webpack, or Rollup. Because of it, many of them are designed with the implicit assumption that they'll be tree-shaken and exported as a single module (e.g., index.js) that loads the entire graph, **including the modules you are not using**. We could have a similar tooling in the CLI project, but we decided to keep the tooling stack as lean as possible and thus prevent issues that might arise due to the tooling indirection (e.g., invalid source maps or code that don't map 1-to-1 to the source and complicates debugging). Therefore we recommend that:

- You avoid dependencies unless they are strictly necessary. Bring it up to the team in case of doubt.
- When deciding on a dependency, their interface must be modular (many exports over a single one). In other words, avoid monolithic dependencies.
- If the dependency is large and uses ESM, use dynamic imports to import it. Note that it'll make the dependent modules' APIs asynchronous, but it'll be improved once this [TC39 proposal](https://github.com/tc39/proposal-defer-import-eval) lands.
- As a **last resource**, if a dependency is a bottleneck, you can use its CJS version or dynamically import it when needed using `await import("my-dependency")`.

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

