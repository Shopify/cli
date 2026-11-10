---
id: MISSING_EMBEDDED_CSP
version: 4
severity: medium
---

Find embedded Shopify apps that are missing a Content-Security-Policy
`frame-ancestors` directive, allowing any origin to iframe the app.

Shopify apps run inside an iframe in the admin. Without a
`frame-ancestors` directive in the CSP header, any website can embed the
app in an iframe — a clickjacking risk. The attacker overlays invisible
elements on top of the app's UI to trick the merchant into clicking
buttons they can't see.

## What to look for

1. **Determine if the app is embedded.** Check each `shopify.app*.toml`
   for the top-level `embedded = true` setting, which makes the app render
   inside the Shopify admin. If no configuration sets `embedded = true`, the
   app is not embedded and this check does not apply. Theme app extensions
   and app embed blocks run on the storefront, so they don't make an app
   embedded in the admin.

2. **Find where HTTP response headers are set.** Search for:
   - `Content-Security-Policy` in any file
   - `addDocumentResponseHeaders` (Shopify Remix helper)
   - `response.headers.set`
   - `frame-ancestors`
   - CSP middleware configuration

3. **If CSP headers are set, check for `frame-ancestors`.** The directive
   must be present and must restrict embedding to:
   - `https://admin.shopify.com`
   - The authenticated shop's domain (e.g. `https://my-shop.myshopify.com`)

   A wildcard `frame-ancestors *` is not safe. An absent `frame-ancestors`
   is not safe (browsers default to allowing any origin).

4. **Check for the Shopify app SDK helper.** If the app uses
   `@shopify/shopify-app-react-router` or `@shopify/shopify-app-remix`, the
   `addDocumentResponseHeaders` function sets the correct CSP automatically.
   If it's called on document responses, the app is safe.

5. **Check for `X-Frame-Options` as a fallback.** Some apps use
   `X-Frame-Options: ALLOW-FROM https://admin.shopify.com` instead of
   CSP `frame-ancestors`. This is deprecated but functional in some
   browsers. Note it but don't flag if CSP is also present.

6. **Require a concrete clickjacking impact.** Missing `frame-ancestors` is only a
   finding when the embedded surface exposes a sensitive action or privileged UI
   that an attacker could trick the merchant into invoking. If the surface is
   informational only or the impact cannot be established, keep it unresolved.

## What to report

For embedded apps with no `frame-ancestors` directive and a concrete sensitive UI action:

```json
{
  "file": "app/root.tsx",
  "line": 1,
  "message": "Embedded app has no frame-ancestors CSP directive — any origin can iframe it",
  "evidence": [
    { "file": "shopify.app.toml", "line": 5, "quote": "embedded = true" },
    {
      "file": "app/root.tsx",
      "line": 1,
      "quote": "no addDocumentResponseHeaders or CSP header found"
    }
  ],
  "confidence": "medium",
  "reasoning": "The app sets embedded = true but no file sets a Content-Security-Policy with frame-ancestors, and the embedded surface exposes a privileged action that can be clickjacked."
}
```

Do not report:

- Non-embedded apps (no `shopify.app*.toml` sets `embedded = true`)
- Apps that call `addDocumentResponseHeaders` (handles CSP automatically)
- Apps with an explicit `frame-ancestors` directive in their CSP
- Embedded surfaces with no demonstrated sensitive action or privileged UI
- Test files (under test/ or \*_test.rb)
