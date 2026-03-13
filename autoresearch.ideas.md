# Autoresearch Ideas

## Final State
- **Baseline: 610ms → Current: 160ms (74% improvement)**
- All universal optimizations — benefit every command equally
- Startup chunk size: ~355KB (12 chunks, minified, compile-cached)
- Version command: ~145ms, --version flag: ~60ms
- Help benchmark: 160ms (±20ms variance from system noise)

## What We Did (all applied)
1. Separate bootstrap.ts from index.ts (don't load 106 commands upfront)
2. Lazy command loading via registry (only load the needed command)
3. Fire-and-forget init/prerun/postrun hooks (deferred to after command)
4. Custom lightweight dispatcher (bypass oclif.run() for known commands)
5. Deferred error-handler import (only on error path)
6. TypeScript compiler externalized from bundle (~9MB → external)
7. Native Node.js builtins in custom-oclif-loader (avoid fs.js/execa chains)
8. process.exit(0) after command (skip waiting for analytics/network)
9. V8 compile cache via module.enableCompileCache()
10. Full esbuild minification (whitespace + identifiers + syntax)
11. Lazy ui.js/error-handler/notifications-system/environments.js in base-command
12. Inlined terminalSupportsPrompting (avoid system.js → execa chain)
13. Static imports for ShopifyConfig + oclif settings (eliminate async hops)
14. Type-only imports for interfaces/types (prevent accidental runtime deps)
15. Skip async exitIfOldNodeVersion for Node ≥ 18

## Remaining Opportunities (major effort required)

### Would help but needs framework changes
- **Replace oclif with lighter framework**: oclif core (270KB minified) + help rendering (~80ms) dominates remaining time
- **V8 startup snapshot**: Serialize loaded module graph. Would cut cold start to ~50ms. Complex Node.js API.
- **AOT compilation**: Use Node.js experimental compile cache or ahead-of-time compilation

### Won't help (confirmed)
- splitting: false (incompatible with dynamic imports)
- Reduce entry points (chunk boundaries change but no timing improvement)
- Defer global-agent (no impact at current code size)
- Type-only imports alone (esbuild already tree-shakes)
- Make output.js/metadata.js lazy in base-command (parallel → sequential = worse)

## Key Lessons
1. **Static imports inside a lazy module load in parallel**; converting to dynamic makes them sequential = worse
2. **V8 compile cache** saves ~35ms but needs warm-up runs after rebuild
3. **CJS shim overhead (48ms)** is inherent to esbuild ESM code splitting — can't be eliminated
4. **oclif help rendering (~80ms)** dominates the help benchmark; actual commands are 60ms faster
5. **Measurement noise**: /usr/bin/time has 10ms granularity; need median of 7+ runs for stability
