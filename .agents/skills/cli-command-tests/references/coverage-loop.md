# Coverage-guided validation

Use two gates: meaningful behavioral assertions and measured source coverage. Neither substitutes for the other.

## What exists now

Run the complete app-info coverage pipeline from the repository root:

```sh
pnpm test:commands:coverage
```

The command performs four steps:

1. Builds an unminified CLI bundle with linked source maps.
2. Runs `test/app-info.test.ts` and collects V8 coverage from each spawned CLI process.
3. Uses c8 to merge and map those reports to the original TypeScript sources.
4. Checks `test/app-info/coverage-scope.json` with `pnpm test:commands:coverage:check`.

Artifacts remain under `coverage/commands/app-info/`. The mapped report is `report/coverage-summary.json`; `raw/` contains per-process V8 ranges filtered to generated CLI chunks that map to the declared scope. The harness removes repeated embedded source maps before retaining these files, and the runner restores one verified map per generated chunk during conversion.

Use `--scope`, `--test-file`, and `--output` to run another command suite. `--test-name` is useful for testing the pipeline, but a focused run is not command-wide coverage evidence.

The coverage build is deliberate. Normal bundles use minified output and external maps without source-map comments, which does not preserve useful branch and function mapping. `SHOPIFY_CLI_SOURCE_COVERAGE=1` changes those build options only for this coverage run.

## Declare the scope before measuring

List production source files reached by the command: its command handler, result formatting, command-specific services, and relevant loading/authentication/state paths. Explain exclusions before the first measurement. Shared files containing other commands may need separate context metrics or an explicitly agreed scope exception; do not silently discard their uncovered command behavior.

Copy and adapt [the example scope](../assets/coverage-scope.example.json). That example is an app-info **renderer pilot**, not the complete app-info execution scope. Extend it from the traced call path before claiming command-wide coverage.

Default targets are 90% lines, 80% branches, and 90% functions for every scoped file and the aggregate. Record any user-approved alternatives. Freeze the file list and targets for the loop. A missing source file is a failed gate, not a zero-length file with 100% coverage.

Keep high-priority behavior rows separate: every in-scope credential, selection, destructive-effect, result-mode, and partial-failure row needs a meaningful passing assertion even when percentages are high.

## Collect real CLI evidence

Run `pnpm test:commands:coverage` from the repository root. The runner clears its output directory first, preserves the test exit status, and stops before checking thresholds when the suite fails.

For another command, supply its scope and test file:

```sh
pnpm test:commands:coverage \
  --scope test/<command-slug>/coverage-scope.json \
  --test-file <command-slug>.test.ts \
  --output coverage/commands/<command-slug>
```

Record the command, Node version, source revision/diff, source scope, build/map identity, test result, and artifact path. Inspect raw reports for the CLI entrypoint or imported CLI bundle chunks. Exclude build tools, Vitest workers, preload code, subprocess stubs, dependencies, and unrelated commands from the production-source denominator.

Each measured invocation needs evidence or an explicit explanation. Forced-kill cases may not flush V8 data. Report those gaps; do not treat absent files as covered or quietly remove those cases from the behavioral suite. Setup/warmup invocations can execute code without asserting it, so hits alone do not close behavior rows.

## Verify mapping

The command automates conversion, but the report still needs provenance checks before its percentages are treated as evidence:

1. Confirm the run used the coverage build and linked maps from the current checkout.
2. Confirm scoped entries resolve to `packages/*/src` paths rather than bundled `dist` files.
3. Include unexecuted scoped production files as missing or zero coverage. Never drop them from the denominator.
4. Verify a known source branch. Its untaken path must appear as uncovered and disappear after the matching test runs.
5. Record the Node and c8 versions with the source revision and scope.

If a mapped file reports no functions or branches where the source clearly contains them, treat mapping as invalid.

Preserve converter name/version, mapping/exclusion settings, and coverage-ignore annotations in the evidence. Labels such as “branch coverage” refer to that converter's model; do not equate an executed V8 range with every semantic outcome.

If mapping, source identity, or required files cannot be verified, stop percentage-based iteration and report **coverage blocked**. Continue useful behavioral validation. Do not substitute minified-bundle percentages or `vitest --coverage` worker results.

## Check the thresholds

The full command runs the threshold checker automatically. To recheck an existing report without rerunning the suite:

```sh
pnpm test:commands:coverage:check \
  test/app-info/coverage-scope.json \
  coverage/commands/app-info/report/coverage-summary.json
```

The implementation is `bin/check-command-coverage.js`. Its independent tests run with:

```sh
node --test bin/check-command-coverage.test.js
```

The checker:

- Validates scoped production paths and required metrics.
- Recomputes percentages from integer totals/covered counts instead of trusting `pct` or the report's global total.
- Checks each file and the selected aggregate against the same thresholds.
- Fails when a requested source file is missing from the summary.
- Reports metrics with no executable items as `null`/not applicable, not 100%.
- Emits a scope fingerprint, per-file source fingerprints, measured counts, and failures as JSON.

Exit codes: **0** applicable thresholds met; **1** thresholds unmet or scoped files missing; **2** invalid input/report. Use `pnpm --silent test:commands:coverage:check` to capture JSON without pnpm's script banner.

The checker validates counts, not their origin. A summary from another build, a Vitest worker, or a manually invented report is invalid evidence even if its arithmetic passes.

## Iterate with a budget

Use at most three improvement rounds and 30 minutes after initial implementation, unless the user supplies another budget.

For each round:

1. Choose the highest-risk unasserted behavior or uncovered branch that this command can reach.
2. Identify the missing state transition and the observable difference it should cause.
3. Add or strengthen the smallest case. Prefer a distinct input/outcome over another nearly identical fixture.
4. Run the focused case, then the full command suite and static checks.
5. Collect a fresh coverage run, map/merge it, run the checker, and record the change against the fixed scope.
6. Review whether the assertion would catch a plausible regression. A percentage gain without a better assertion is not progress.

Stop when both gates pass. Stop earlier if the budget runs out, a round adds no useful assertion or measured gain, or a tooling/safety problem blocks measurement. Report unresolved branch and behavior IDs with reasons. Ask before changing scope, production behavior, dependencies, or targets.

Do not add unrelated commands merely to execute shared source, mock internal production functions to force hits, weaken an expectation, or add ignore annotations to reach a number.

## Report completion honestly

Include tests passed/failed, source scope and exclusions, per-file and aggregate percentages, converter/build provenance, iteration count, artifact paths, and unflushed/unmapped cases. Distinguish:

- **Thresholds met:** numerical result for the declared scope.
- **Behavior asserted:** planned outcomes are checked by passing command tests.
- **Not established:** untested platforms, unreadable-file/store failures, remaining formats, or unavailable coverage mapping.

“261 tests pass” and “raw V8 files exist” are useful facts. Neither is a source-coverage result.
