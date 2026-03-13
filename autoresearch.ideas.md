# Autoresearch Ideas

## Current State
- Baseline: 610ms → Current: 190ms (69% improvement, all universal)
- Startup chunk size: ~694KB (down from 9.5MB)
- Node startup: ~40ms, V8 compile: ~40ms, oclif+command: ~110ms

## Proven Techniques (already applied)
- Separate bootstrap from index.ts (don't load all commands upfront)
- Lazy command loading via registry
- Lazy prerun/postrun/init hooks (fire-and-forget after command)
- Deferred error-handler (only on error path)
- TypeScript compiler externalized from bundle
- Native Node.js builtins instead of cli-kit wrappers in hot path
- process.exit(0) to skip waiting for analytics/network

## Ideas to Explore

### Medium Impact
- **Reduce @oclif/core chunk size**: The oclif chunk is 520KB. Can we tree-shake unused parts (oclif update system, plugin management, etc.)? Custom esbuild plugin to strip dead code paths.
- **Lazy command class loading in oclif**: Override Config.loadPluginsAndCommands to skip loading command classes upfront. Only load the manifest metadata.
- **Optimize oclif config.load()**: Profile what config.load() actually does. May read multiple package.json files, resolve symlinks, etc.
- **Replace conf package**: LocalStorage uses `conf` (creates atomic JSON files). A lighter implementation could save ~20ms.

### Low Impact (diminishing returns)
- **V8 code cache**: Use `--compile-cache` or similar to cache V8 compiled bytecode. Could save ~40ms of compile time.
- **Inline oclif manifest into bundle**: Instead of reading JSON from disk, include the manifest as a JS object. Saves ~5ms.
- **Reduce CJS shim overhead**: The esbuild CJS-to-ESM bridge takes ~33ms. Converting deps to ESM would help but is impractical.

### Tried and Didn't Work
- ~~Pre-warm hook modules~~ (ESM loader is single-threaded, adds contention)
- ~~Lazy session.js in analytics~~ (sequential dynamic import is slower than parallel static)
- ~~Defer global-agent~~ (only 72KB, no measurable impact at this code size)
- ~~Skip hydrogen plugin when not installed~~ (oclif handles missing plugins quickly)
- ~~Replace help command with oclif built-in~~ (worse and inconsistent)
