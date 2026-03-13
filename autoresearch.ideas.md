# Autoresearch Ideas

## Current State
- Baseline: 610ms → Current: 160ms (74% improvement, all universal)
- Startup chunk size: ~352KB (12 chunks, minified)
- With V8 compile cache: ~150ms stable
- Profile: 40ms V8 compile (cached ~5ms), 40ms CJS shims, 20ms oclif eval, ~60ms oclif.run()

## Proven Techniques (already applied)
- Separate bootstrap from index.ts (don't load all commands upfront)
- Lazy command loading via registry
- Lazy prerun/postrun/init hooks (fire-and-forget after command)
- Deferred error-handler (only on error path)
- TypeScript compiler externalized from bundle
- Native Node.js builtins instead of cli-kit wrappers in hot path
- process.exit(0) to skip waiting for analytics/network
- V8 compile cache (module.enableCompileCache())
- Full minification (whitespace + identifiers)
- Lazy ui.js/error-handler/notifications-system in base-command

## Ideas to Explore

### Medium Impact
- **Reduce oclif.run() overhead**: oclif.run() takes ~95-115ms. Profile what's slow inside it. Config.load() reuse check, Performance markers, normalizeArgv — any optimizable?
- **Preload oclif Help class**: For help command specifically, oclif loads Help class + formatting (ejs, string-width, wrap-ansi) lazily. Could preload during config.load().
- **Override oclif.run() with lighter dispatcher**: Bypass oclif's run() for known commands. Issue: normalizeArgv (space-separated topics) requires oclif internals. CJS/ESM interop broke dynamic import of @oclif/core/help.
- **Single-file bundle with custom wrapper**: Instead of esbuild splitting, create a custom bundle that concatenates modules with async-compatible wrappers. Complex but could eliminate CJS shim overhead.

### Low Impact (diminishing returns at 160ms)
- **V8 snapshot**: Create a snapshot of the loaded module graph. Would reduce cold start to ~50ms. Complex to implement and maintain.
- **Inline oclif manifest into bundle**: Include manifest as JS object instead of JSON file read. Saves ~5ms.
- **Reduce CJS shim overhead**: 40ms for CJS→ESM bridge. Inherent cost of esbuild ESM splitting.

### Tried and Didn't Work
- ~~Pre-warm hook modules~~ (ESM loader is single-threaded, adds contention)
- ~~Lazy session.js in analytics~~ (sequential dynamic import is slower than parallel static)
- ~~Defer global-agent~~ (only 72KB, no measurable impact at this code size)
- ~~Skip hydrogen plugin when not installed~~ (oclif handles missing plugins quickly)
- ~~Replace help command with oclif built-in~~ (worse and inconsistent)
- ~~Reduce entry points~~ (from 51→30: chunk count changed but no wall time improvement)
- ~~splitting: false in esbuild~~ (INCOMPATIBLE: dynamic imports create top-level await inside non-async __esm() wrappers → SyntaxError. cli-kit uses `await import()` pervasively. CJS format incompatible with "type": "module")
