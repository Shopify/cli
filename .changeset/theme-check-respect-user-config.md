---
'@shopify/app': patch
---

`runThemeCheck` now respects a user's `.theme-check.yml` in the theme app extension root. When present, theme-check-node auto-discovery is used; otherwise the bundled `theme-check:theme-app-extension` config is applied as before. This lets extensions ignore source directories (e.g. a `src/` folder containing uncompiled Liquid templates) without forking the CLI.
