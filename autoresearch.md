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
(nothing yet — baseline run pending)
