# Autoresearch Ideas

## Key Insights
- Original baseline is ~590ms wall / ~420ms user (not 1840ms as initially measured cold)
- Static imports are loaded in parallel by ESM loader; dynamic awaits are sequential
- Network calls (analytics POST, version check) add 100-500ms wall clock time
- The postrun hook (analytics, deprecation checks) takes ~400ms CPU when loaded cold

## Ideas to Explore

### High Impact
- **Bundle bootstrap + hot path with esbuild**: Single file eliminates hundreds of file I/O operations. The existing `bin/bundle.js` already does this but bundles ALL files. A targeted bundle of just the startup path (bootstrap → cli → oclif → config.load → hooks) could be much smaller and faster.
- **Pre-warm hook modules**: Start importing postrun/prerun dependencies in the background right after config.load(), so they're cached by the time hooks run. Use `void import(...)` to trigger loading without blocking.
- **Reduce @oclif/core cold load cost**: Oclif itself takes ~50-80ms. Check if we can use a lighter subset.
- **Move analytics to a detached child process**: Fire off analytics data to a background script that handles the HTTP POST. CLI exits immediately.

### Medium Impact
- **Reduce node-package-manager.js weight**: It imports latest-version, semver, conf-store. These are only needed for version checking. Make them lazy.
- **Replace node-fetch with native fetch**: Node 18+ has built-in fetch. Saves ~127ms of module loading.
- **Reduce conf package overhead**: The `conf` package loads atomically, parses JSON config. Consider a lighter alternative or lazy init.
- **Tree-shake @shopify/cli-kit**: Many modules import the full output.js chain even when they only need simple utilities.

### Low Impact / Risky
- **Skip postrun for lightweight commands**: version, help, search don't need analytics. But this breaks analytics tracking.
- **Use V8 code cache / snapshots**: Node.js can serialize compiled code. Complex to set up but could save 100-200ms.
- **Compile to a single binary**: Use pkg or sea (Node single executable). Eliminates all module resolution.
