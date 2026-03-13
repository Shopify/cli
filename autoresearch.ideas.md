# Autoresearch Ideas

## High Impact
- **Test sharding on Windows**: Split vitest into 2-4 shards running in parallel on Windows. Each shard runs a subset of test files. The wall clock time should drop proportionally.
- **Switch from forks to threads pool**: `threads` shares memory between workers, less overhead on spawn. Could significantly help Windows where process creation is expensive.
- **Lighter reporter**: `verbose` reporter writes a line per test. Switch to `dot` or `default` to reduce I/O overhead (especially impactful on Windows).
- **Reduce collect time**: 577s collect time in local run is very high. May be able to optimize with `--no-file-parallelism` or better config.

## Medium Impact
- **Increase VITEST_MAX_THREADS**: Currently 4. GitHub Actions runners have 4 cores on Windows. Could try higher for I/O bound tests.
- **Remove hanging-process reporter**: Extra overhead tracking process handles.
- **Optimize setup**: The `setup.js` runs for every test file. Could be streamlined.
- **Cache pnpm store across runs**: Already using pnpm cache, but check if it's effective on Windows.

## Lower Impact / Risky
- **Exclude packages from vitest workspace on Windows**: e.g., ui-extensions packages are small, but might not save much.
- **Parallel CI jobs with matrix include/exclude**: Run different packages on different jobs.
- **Move Windows to ubuntu with Wine**: Unlikely to work but creative.
