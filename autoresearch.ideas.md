# Autoresearch Ideas

## Already Tried (don't repeat)
- ✅ Lighter reporter in CI — done
- ✅ 2-way Windows sharding — done
- ✅ Coverage sharding + coverage.all=false — done
- ✅ Remove ui-extensions-test-utils from workspace (no tests) — done, -8% local
- ❌ Threads pool — slower (mock contention)
- ❌ vmForks pool — 15 test failures
- ❌ vmThreads pool — 15 failures + SIGABRT crash
- ❌ v8 coverage provider — slower
- ❌ More threads (6) — no improvement over 4
- ❌ More threads (8) — CPU contention
- ❌ Narrow includeSource — slower
- ❌ @shopify/app alias — circular import overhead
- ❌ 3-way Windows sharding — diminishing returns (bottleneck shifts to Ubuntu/macOS)
- ❌ Move graphql-codegen to ubuntu — fails (platform-specific output)
- ❌ sequence.hooks=parallel — hangs
- ❌ isolate=false — crashes with forks pool
- ❌ Remove build from coverage (with all=true) — build required
- ❌ dot reporter — actually slower than default locally (100s vs 66s)
- ❌ Switch to Bun — Too risky. Setup is only 20-67s (~20% of job). pnpm-workspace.yaml, publicHoistPattern, linkWorkspacePackages incompatible. Would need lockfile migration. Test runtime (80% of job) unchanged since vitest still runs on Node.

## Remaining Ideas to Try
- **Optimize pnpm install on Windows**: Windows setup takes ~55-70s vs ~30s on ubuntu. Try `--prefer-offline`, `--frozen-lockfile` is already used. Maybe `store-dir` caching or `node-linker=hoisted`.
- **Reduce vitest collect time**: Collect is 462s cumulative (7.5x test time). Try `--typecheck=false` explicitly, `--config` overrides to skip unused plugins, or `deps.optimizer.ssr.enabled`.
- **Shard macOS/ubuntu tests**: macOS Node 24 hit 5.2m. 2-way sharding could bring to ~3.5m. Adds 6 jobs but cuts bottleneck.
- **Pre-bundle deps with vitest optimizer**: `deps.optimizer.ssr.enabled: true` could speed up module resolution/collection.
- **Turbo cache for pnpm install**: Use turborepo or nx caching to speed up install step.
- **Combine lint + type-check into one job**: Both ~1.2-1.6m on ubuntu. Not bottleneck but reduces compute.
- **Optimize the 8.5s extension.test.ts**: Slowest single test file. May have unnecessary setup/teardown.
- **Profile slow test collection**: Some workspace projects may have expensive setup.ts files.
