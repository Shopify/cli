# Bundle Size Reduction Ideas

## Remaining Targets (by input size)
- **react-reconciler@0.32.0** (~1 MB): Core of ink@6, can't externalize without externalizing ink itself
- **graphql** (~610 KB): Tried externalizing — caused cli-launcher test timeout. Needs investigation.
- **@oclif/core** (~592 KB): 58 import sites, deeply integrated. Could externalize but risky.
- **@shopify/cli-hydrogen** (~353 KB): Direct hydrogen CLI code
- **iconv-lite** (~314 KB): Used by body-parser/raw-body for HTTP charset decoding
- **yaml** (~279 KB): Used for YAML parsing
- **esprima** (~277 KB): JS parser, likely used by theme-check or language server
- **minimatch** (~272 KB): Glob matching, used in many places
- **es-toolkit** (~243 KB): Modern utility library (already a lodash replacement)
- **acorn** (~237 KB): JS parser
- **async** (~220 KB): Async utilities
- **tr46** (~216 KB): Unicode normalization for URL parsing
- **js-yaml** (~213 KB): YAML parsing (in addition to yaml package)
- **web-streams-polyfill** (~207 KB): Polyfill for web streams
- **ajv** (~206 KB): JSON schema validation

## Build Config Possibilities
- Investigate if `splitting: false` produces smaller output (eliminates chunk overhead)
- Consider externalizing more @shopify/* packages that are transitive deps

## Done ✅
- ~~Replace brotli JS with native zlib~~ (saved ~5.9 MB)
- ~~Enable minifyWhitespace~~ (saved ~14 MB)
- ~~Externalize prettier~~ (saved ~11.7 MB)
- ~~Externalize ts-morph~~ (saved ~23 MB)
- ~~Externalize typescript~~ (saved ~19 MB)
- ~~Disable source maps~~ (saved ~35.7 MB)
- ~~Enable minifyIdentifiers~~ (saved ~4.7 MB)
- ~~Externalize polaris + polaris-icons + polaris-tokens~~ (saved ~1.1 MB)
- ~~Externalize react-dom~~ (saved ~524 KB)
- ~~Externalize vscode language services~~ (saved ~992 KB)
- ~~Externalize @oclif/table~~ (saved ~424 KB)
- ~~Externalize lodash~~ (saved ~112 KB)
- ~~Externalize @opentelemetry~~ (saved ~416 KB)
- ~~Externalize theme-check/language-server + ohm-js + liquid-html-parser + @vscode/web-custom-data~~ (saved ~1.1 MB)
