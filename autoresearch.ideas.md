# Autoresearch Ideas

## Already Tried (don't repeat)
- ✅ Lighter reporter in CI — done
- ✅ 2-way Windows sharding — done
- ✅ Coverage sharding + coverage.all=false — done
- ❌ Threads pool — slower (mock contention)
- ❌ vmForks pool — 15 test failures
- ❌ v8 coverage provider — slower
- ❌ More threads (8) — CPU contention
- ❌ Narrow includeSource — slower
- ❌ @shopify/app alias — circular import overhead
- ❌ 3-way Windows sharding — diminishing returns (bottleneck shifts to Ubuntu/macOS)
- ❌ Move graphql-codegen to ubuntu — fails (platform-specific output)
- ❌ sequence.hooks=parallel — hangs
- ❌ isolate=false — crashes with forks pool
- ❌ Remove build from coverage (with all=true) — build required

## Remaining Ideas to Try
- **Combine lint + type-check into one job**: Both run on ubuntu, ~1.6m and ~1.2m each. Combining saves one setup (~30s). Not bottleneck but reduces overall compute.
- **Optimize pnpm install on Windows**: Windows setup takes ~55-70s vs ~30s on ubuntu. Try `--prefer-offline`, `--frozen-lockfile` is already used. Maybe `store-dir` caching.
- **Reduce vitest collect time**: Collect is 462s cumulative (7.5x test time). Try `--typecheck=false` explicitly, `--config` overrides to skip unused plugins.
- **Use `--reporter dot` in CI instead of `default`**: Dot is even lighter than default. Test locally first.
- **Shard ubuntu tests too**: Ubuntu Node 24 at ~4.7m, could shard to ~3.5m. But adds jobs.
- **Run only affected tests on PR**: Use vitest `--changed` flag. Risky — might miss regressions.
- **Disable `clearMocks`/`mockReset` overhead**: These run per-test. Check if removing one helps. Must not break tests.
- **Profile vitest startup**: Use `--reporter=verbose --logHeapUsage` to find memory/CPU bottlenecks in specific test files.
- **Optimize the 8.5s extension.test.ts**: Slowest single test file. May have unnecessary setup/teardown.
