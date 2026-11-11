---
'@shopify/app': patch
'@shopify/cli': patch
---

Fix four `shopify app security check` agent prompts that could skip real issues: `MISSING_EMBEDDED_CSP` now detects embedded apps from `embedded = true`, `SSRF_REQUEST_FORGERY` and `SCRIPT_TAG_URL_INJECTION` no longer treat an https-only URL as safe, and `THEME_EXTENSION_XSS` no longer exempts `escape` in executable contexts or `textContent` on `<script>` elements
