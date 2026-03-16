# Autoresearch: Faster `pnpm test:unit`

## Objective
Optimize the wall-clock duration of `pnpm vitest run` (the full unit test suite) in the Shopify CLI monorepo. Currently ~66s wall clock. The dominant bottleneck is the **collect phase (~480s cumulative)** — importing/parsing all test files across 9 workspace projects. Actual test execution is ~73s cumulative. The suite uses vitest 3.2.4 with `pool: 'forks'` across 11 CPU cores.

## Metrics
- **Primary**: `wall_clock_s` (seconds, lower is better) — total wall-clock time of `pnpm vitest run`
- **Secondary**: `collect_s`, `tests_s`, `transform_s`, `setup_s`, `prepare_s` — from vitest Duration line

## How to Run
`./autoresearch.sh` — outputs `METRIC name=number` lines parsed from vitest output.

## Files in Scope
- `configurations/vite.config.ts` — shared vitest/vite config (pool strategy, timeouts, aliases, reporters)
- `configurations/vitest/setup.js` — global test setup
- `vitest.workspace.json` — workspace project list
- `packages/*/vite.config.ts` and `packages/*/vite.config.mts` — per-package vitest configs
- `vite.config.ts` — root config
- Any test files or source files if restructuring helps

## Off Limits
- Test correctness: all 3794+ tests must still pass (4 skipped OK)
- Don't delete or skip tests
- Don't remove test coverage

## Constraints
- All tests must pass (`pnpm vitest run` exit 0)
- No tests may be removed or skipped
- The 1 pre-existing failing test (`node-package-manager.test.ts`) may remain failing — it was already failing before

## What's Been Tried
- **pool: threads** (KEEP) — ~17% faster than forks. Consistently 65-70s vs 80s+ with forks.
- **Remove includeSource** (KEEP) — extracted single in-source test to separate file, small gain.
- **reporters: dot** (KEEP) — committed alongside other changes, minimal impact.
- **pool: vmThreads** — 89 failures due to VM isolation issues. Discard.
- **isolate: false** — collect dropped from 415s to 99s (5x!) but 458 test failures. Tests depend on isolation.
- **maxThreads=8** — less parallelism hurts wall clock despite lower cumulative collect.
- **maxThreads=3/5/7/10/11/14** — sweet spot is 10 (default ncpu-1). More threads = more collect contention.
- **deps.optimizer.ssr.enabled** — no improvement.
- **esbuild target node20** — slower.
- **server.deps.inline** — no improvement.
- **clearMocks/mockReset: false** — 286 failures.
- **deps.interopDefault** — 286 failures. 
- **resolve.extensions** — no improvement.
- **optimizeDeps.holdUntilCrawlEnd** — part of combo that caused 286 failures.
- **globals: true** — no improvement.
- **singleThread** — 264s, no parallelism.
- **--shard** — both shards take full time due to resource contention.
- **Removed empty workspace project** — no meaningful improvement.
- **test.projects** — wrong config application, 58 failures.

### Key Insights
- Wall clock is 65-70s with threads, collect is ~500s cumulative (the bottleneck).
- Heavy system load causes high variance (54s to 70s measured for same config).
- collect_s scales linearly with thread count — contention is significant.
- The module graph is heavy: 500+ source files, cli-kit's fs.ts imports 6+ large libs.
- The 286-failure pattern appears when mocking/interop defaults change.
- Environment setup (jsdom) adds 7-15s for UI component tests.
