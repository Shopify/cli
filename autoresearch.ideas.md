# Bundle Size Reduction Ideas

## High Impact (>1 MB savings each)
- **Disable source maps** (`sourcemap: false`): Maps are 35.9 MB / 63% of current bundle. Used by stacktracey for Bugsnag error reporting — verify if needed in release
- **Replace lodash with es-toolkit or specific imports** (~700 KB input): lodash is fully bundled. es-toolkit is already in the bundle (243 KB) so there may be overlap
- **Deduplicate react-reconciler** (two versions: 0.29.2 + 0.32.0 = ~1.8 MB input): ink v5 vs ink v6 pulling different versions

## Medium Impact (200 KB–1 MB)
- **Externalize/remove polaris + polaris-icons** (~2.1 MB input): Only used for GraphiQL HTML template rendering. Could pre-render to static HTML at build time
- **Replace iconv-lite** (~314 KB): May not be needed if only UTF-8 is used
- **Minimize @opentelemetry bundle** (~1 MB total): Check if all OTel packages are needed
- **Reduce @vscode/web-custom-data** (~321 KB): Large data file for theme language server

## Build Config Tweaks
- Enable `minifyIdentifiers: true` — more aggressive but might cause issues with dynamic property access
- Check if `splitting: true` is optimal or if single-file would be smaller (less chunk overhead)

## Done ✅
- ~~Externalize ts-morph + typescript~~ (saved ~42 MB)
- ~~Externalize prettier~~ (saved ~11.7 MB)
- ~~Enable minifyWhitespace~~ (saved ~14 MB)
- ~~Replace brotli JS with native zlib~~ (saved ~5.9 MB)
