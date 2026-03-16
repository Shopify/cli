# Autoresearch Ideas

- **isolate: false** — drops collect from 415s to 99s but breaks 458 tests. If test isolation issues could be fixed (shared state, mock leaks), this would be a huge win. Would need systematic cleanup of global state in tests.
- **Shard across multiple vitest instances** — run packages in parallel as separate processes to maximize CPU utilization. E.g., `vitest run --project=app & vitest run --project=cli-kit &` etc.
- **Module caching / pre-bundling** — vitest deps optimization could help collect time by pre-bundling heavy deps
- **Reduce heavy imports** — profile which modules take longest to collect. Large barrel exports or heavy dependencies slow down every test file that imports them.
- **Split large test files** — if some test files are disproportionately slow, splitting them could improve parallelism
