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
- ❌ Switch to Bun — Too risky. Setup is only 20-67s (~20% of job). pnpm-workspace.yaml, publicHoistPattern incompatible.
- ❌ deps.optimizer.ssr.enabled — 1 failure, 126s (2x slower), collect time explodes
- ❌ server.deps.optimizer.ssr.enabled — 75s (15% slower)
- ❌ --sequence.concurrent — 172 failures (tests share mocked state)
- ❌ --prefer-offline for pnpm install — no measurable improvement (store cache already warm)
- ❌ Cache node_modules directly — pnpm uses hard links to store, breaks on cache restore without store
- ❌ single fork (VITEST_MAX_THREADS=1) — 180s wall clock (3x slower), no parallelism

## Remaining Ideas to Try
- **Cache node_modules + pnpm store together**: Cache both `node_modules` AND the pnpm store. The store path can be gotten via `pnpm store path`. This would restore hard links correctly and skip install entirely.
- **Use `node-linker=hoisted` for CI**: Changes pnpm to use flat node_modules (like npm) instead of symlinks. Enables simple node_modules caching. May break some imports.
- **Shard macOS/ubuntu tests**: macOS Node 24 hit 5.2m. 2-way sharding could bring to ~3.5m but adds 6 extra jobs.
- **Optimize the 8.5s extension.test.ts**: Slowest single test file. May have unnecessary setup/teardown.
- **Profile slow test collection**: Some workspace projects may have expensive setup.ts files.
- **Reduce workspace projects further**: Check if plugin-cloudflare (2 tests) and plugin-did-you-mean (5 tests) can use the root vite config instead of separate workspace entries.
