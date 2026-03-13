# Autoresearch Ideas

## Current State
- Baseline: 610ms → Current: 160ms (74% improvement, all universal)
- Startup chunk size: ~355KB (12 chunks, minified)
- With V8 compile cache (warm): 150-160ms stable
- Version command: ~145ms, --version flag: ~60ms
- Help benchmark has ±20ms variance due to 10ms /usr/bin/time granularity

## Profile (160ms warm, `help`):
- 48ms: CJS shim wrappers (__esm pattern, called per chunk)
- 28ms: GC + microtask queue + misc
- 14ms: oclif core evaluation
- 10ms: help-specific chunk loading
- 9ms: Node builtin module loading (realm)
- 8ms: undici (fetch internals, from global-agent)
- 6ms: V8 compile (from cache — was 40ms cold)
- rest: spread across many chunks

## Proven Techniques (all applied)
- Separate bootstrap from index.ts (don't load all commands upfront)
- Lazy command loading via registry (command-registry.ts)
- Lazy prerun/postrun/init hooks (fire-and-forget after command)
- Custom lightweight dispatcher (bypasses oclif.run() for known commands)
- Deferred error-handler (only on error path)
- TypeScript compiler externalized from bundle (~9MB savings)
- Native Node.js builtins instead of cli-kit wrappers in hot path
- process.exit(0) to skip waiting for analytics/network
- V8 compile cache (module.enableCompileCache())
- Full minification (whitespace + identifiers)
- Lazy ui.js/error-handler/notifications-system in base-command
- Inlined terminalSupportsPrompting (avoids system.js→execa chain)
- Lazy environments.js in base-command
- Static ShopifyConfig import (eliminates async hop)

## Remaining Ideas (diminishing returns)

### Possible 10-20ms wins
- **Reduce oclif help rendering**: Pre-render help at build time. Cache formatted help string. Only for help.
- **Single-chunk bootstrap**: Custom esbuild plugin to merge startup chunks into one file. Reduces __esm overhead.
- **Lighter oclif core**: Fork/patch oclif to lazy-load help module, remove performance markers, simplify config loading.

### Likely <5ms wins
- **Inline oclif manifest into bundle**: Include as JS object instead of JSON file read.
- **Type-only imports in output.ts**: Change PackageManager/TokenItem to `import type`. Didn't help in testing.
- **NODE_COMPILE_CACHE env var**: Already using enableCompileCache(). Env var adds nothing.

### Dead ends (tried, confirmed no improvement)
- ~~splitting: false in esbuild~~ (INCOMPATIBLE: dynamic imports → SyntaxError)
- ~~Defer global-agent~~ (no wall-time impact at current code size)
- ~~Skip hydrogen plugin when not installed~~ (oclif handles quickly)
- ~~Reduce entry points~~ (chunk boundaries change but no timing improvement)
- ~~Pre-warm hook modules~~ (ESM single-threaded, adds contention)
- ~~Lazy session.js~~ (sequential worse than parallel static)
- ~~Type-only PackageManager import~~ (chunk structure unchanged, no help)
- ~~Bypass oclif.run() for help~~ (normalizeArgv interop issues; still needed for help/topics)

## Architecture Notes
- 12 startup chunks is the minimum with current esbuild splitting + ESM
- CJS shim overhead (48ms) is inherent to esbuild's ESM splitting approach
- Compile cache reduces V8 compile from 40ms→6ms but needs warm-up runs
- oclif help rendering (~80ms) dominates the help benchmark; actual commands are ~60ms faster
