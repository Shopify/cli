# Autoresearch: Optimize CI Time

## Objective
Reduce wall-clock time of the slowest CI check in the Shopify CLI PR workflow (tests-pr.yml).
Currently the bottleneck is "Unit tests on Windows" which runs `pnpm vitest run` across 3 Node versions.

## Metrics
- **Primary**: slowest_ci_job_min (minutes, lower is better) — wall-clock time of the slowest CI job
- **Secondary**: total_ci_min (total workflow time), num_jobs (number of matrix jobs)

## How to Run
This is a CI-based experiment. Each iteration:
1. Make changes to CI config / test config
2. Push to `faster-ci` branch
3. Check CI times at https://github.com/Shopify/cli/pull/7002
4. Record the time of the slowest job

## Files in Scope
- `.github/workflows/tests-pr.yml` — PR CI workflow (main target)
- `.github/workflows/tests-main.yml` — Main branch CI (keep in sync)
- `.github/actions/setup-cli-deps/action.yml` — Dependency setup action
- `configurations/vite.config.ts` — Shared vitest/vite config
- `vitest.workspace.json` — Vitest workspace definition
- `packages/*/vite.config.ts` — Per-package vitest configs

## Off Limits
- Test files themselves (must not delete/skip tests)
- Package source code
- Coverage thresholds must be maintained

## Constraints
- CI must stay green (all checks pass)
- Test coverage must be maintained
- All platforms (ubuntu, macos, windows) must still be tested
- All Node versions (20, 22, 24) must still be tested

## Architecture
- 350 test files, ~89K lines across 8 packages
- `app` package has 179 test files (largest)
- Uses vitest with `forks` pool strategy, `verbose` reporter
- CI sets VITEST_MAX_THREADS=4
- Windows timeout per test: 13s (vs 5s default)

## What's Been Tried

### Wins
1. **Lighter reporter in CI** (verbose → default): Saved ~1m on verbose output overhead
2. **2-way Windows sharding**: Windows dropped from 8.7m to ~5m per shard  
3. **coverage.all=false**: Eliminated need for build step in test-coverage job
4. **Coverage sharding**: Split coverage into 2 parallel shards + merge job. Coverage total: 4.1m (was 6.9m)

### Dead Ends
- **Threads pool**: 89s local vs 63s forks — shared memory causes mock contention
- **vmForks pool**: 15 test failures due to stricter VM isolation
- **Narrowing includeSource**: Slower (106s vs 63s) — broad pattern helps vitest file detection
- **@shopify/app alias**: Slower (99s vs 63s) — circular import overhead
- **v8 coverage provider**: Slower (93s vs 63s local)
- **More threads (8)**: Slower due to CPU contention on 4-core runners
- **sequence.hooks=parallel**: Hangs indefinitely
- **isolate=false**: Crashes with forks pool

### Current State
- Bottleneck: Windows Node 20 shard 1/2 at 5.1m
- Windows shards: 4.2-5.1m  
- Coverage: 4.1m (3.2m shard + 0.9m merge)
- Ubuntu: 4.5-4.8m
- macOS: 3.6-4.7m
