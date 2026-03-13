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
(will be updated as experiments run)
