# Bundle Size Reduction Ideas

## High Impact (>1 MB savings each)
- **Disable source maps** (`sourcemap: false`): Maps are 74 MB / 59% of bundle. Used by stacktracey for error reporting — need to verify if actually needed in production release
- **Externalize ts-morph + typescript** (~19 MB input): Used by Hydrogen code gen. Could mark as external and require runtime install
- **Externalize prettier** (~4 MB): Only used in one place (formatting TypeScript type definitions in ui_extension.ts). Could use a lighter formatter or shell out to user's prettier
- **Replace lodash with es-toolkit or specific imports** (~700 KB): lodash is fully bundled. es-toolkit is already in the bundle (243 KB) so there may be overlap
- **Deduplicate react-reconciler** (two versions: 0.29.2 + 0.32.0 = ~1.8 MB): ink v5 vs ink v6 pulling different versions

## Medium Impact (200 KB–1 MB)
- **Externalize/remove polaris + polaris-icons** (~2.1 MB input): Only used for GraphiQL HTML template rendering. Could pre-render to static HTML at build time
- **Replace iconv-lite** (~314 KB): May not be needed if only UTF-8 is used
- **Minimize @opentelemetry bundle** (~1 MB total): Check if all OTel packages are needed
- **Reduce @vscode/web-custom-data** (~321 KB): Large data file for theme language server

## Build Config Tweaks
- Enable `minifyWhitespace: true` in esbuild — currently disabled, could save significant KB
- Enable `minifyIdentifiers: true` — more aggressive but might cause issues with dynamic property access
- Check if `splitting: true` is optimal or if single-file would be smaller (less chunk overhead)
