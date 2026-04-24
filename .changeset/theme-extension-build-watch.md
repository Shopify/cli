---
'@shopify/app': patch
---

Theme app extensions now support `[build].watch` in `shopify.extension.toml` to restrict which files trigger bundle rebuilds during `shopify app dev`. This mirrors the behavior already available for function extensions. When `build.watch` is specified, the CLI only reacts to changes in those paths (plus `locales/**.json` and `**.toml`) instead of the entire extension directory, preventing redundant bundle cycles when an external build tool (e.g. Vite) writes multiple output files.
