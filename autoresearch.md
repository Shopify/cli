# Autoresearch: Optimize CI Time

## Objective
Reduce wall-clock time of the slowest CI check in the Shopify CLI PR workflow (tests-pr.yml).

## Metrics
- **Primary**: slowest_ci_job_min (minutes, lower is better) — wall-clock time of the slowest CI job
- **Secondary**: total_ci_min (total workflow time), num_jobs (number of matrix jobs)

## Results Summary
- **Baseline**: 8.7m (Unit tests with Node 20 on Windows)
- **Current**: ~5.1m (Unit tests, varies by runner)
- **Improvement**: ~41% reduction in slowest CI check time

## Changes Made

### 1. Lighter reporter in CI (configurations/vite.config.ts)
- Changed from `verbose` + `hanging-process` to `default` reporter when `CI=true`
- Reduces I/O overhead from writing a line per test

### 2. Windows test sharding (.github/workflows/tests-pr.yml)
- Split Windows unit tests into 2 shards per Node version
- Each shard runs ~196 test files (50% of total)
- Windows went from 8.7m to ~5m per shard

### 3. Coverage optimization
- **coverage.all=false**: Only instruments tested files, not all source files
  - Eliminates need for build step (saves ~1.5m)
  - `@shopify/app` package no longer needs to be built for coverage
- **Parallel coverage shards**: Split into 2 parallel shard jobs + 1 merge job
  - Each shard: ~3.4m
  - Merge: ~0.8m
  - Total: ~4.2m (was 6.9m)

## Files Modified
- `configurations/vite.config.ts` — CI reporter optimization
- `.github/workflows/tests-pr.yml` — Windows sharding, coverage sharding
- `.github/actions/run-and-save-test-coverage/action.yml` — coverage.all=false
- `.gitignore` — exclude generated files

## What Didn't Work
- Threads pool: Slower due to mock contention
- vmForks pool: 15 test failures
- v8 coverage provider: Slower than istanbul
- More threads (8): CPU contention on 4-core runners
- Narrowing includeSource: Slower (vitest needs broad file detection)
- @shopify/app alias: Circular import overhead
- 3-way Windows sharding: Barely better than 2-way (bottleneck shifts to Ubuntu/macOS)
