# Research Program: Speed up theme commands

## Goal
Improve theme command performance, focusing on boot time and runtime for file-heavy commands like `theme check` and `theme pull`.

## Constraints
- All existing tests must pass: `pnpm test`
- No breaking changes to public APIs
- Must work on macOS, Linux, Windows
- Type checking must pass: `pnpm type-check`

## Current State
Suspected issues:
- Looping over files multiple times
- Redundant async operations
- Code paths executed multiple times unnecessarily

## Target Packages
- `packages/theme/` - theme commands
- `packages/cli-kit/` - shared utilities that theme depends on

## Benchmark Command
```bash
pnpm --filter @shopify/theme vitest run && echo "BENCHMARK: tests passed"
```

Note: Since no formal benchmarks exist, we use test runtime as a proxy. Faster tests = faster code.
For more precise measurement, time specific operations in the test output or add timing to tests.

## Test Commands
```bash
# Run all tests
pnpm test

# Run theme package tests only
pnpm --filter @shopify/theme vitest run

# Type check
pnpm type-check
```

## Ideas to Explore
- Profile startup to identify slow imports
- Cache file system reads
- Parallelize independent async operations
- Lazy load heavy dependencies
- Reduce redundant glob/file operations
- Memoize repeated computations
