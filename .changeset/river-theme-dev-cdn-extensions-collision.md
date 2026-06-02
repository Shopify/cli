---
'@shopify/theme': patch
---

Fix `theme dev` serving a same-named theme asset in response to a `/cdn/extensions/...` request. When a theme and an installed app extension shared an asset filename (e.g. `app.js`), the local dev server's theme matcher swallowed the extension URL prefix and returned the theme file. Extension asset requests now fall through to the CDN proxy (or to a locally-developed extension's filesystem) as intended.
