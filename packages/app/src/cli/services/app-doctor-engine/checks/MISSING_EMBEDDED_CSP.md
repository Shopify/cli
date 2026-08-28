---
id: MISSING_EMBEDDED_CSP
version: 2
tier: agentic
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

1. **Determine if the app is embedded.** Check `shopify.app.toml` for
   `app_embed` or `theme_app_extension` in the capabilities. If the app
   is not embedded, this check does not apply.

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

4. **Check for the Shopify Remix helper.** If the app uses
   `@shopify/shopify-app-remix`, the `addDocumentResponseHeaders` function
   sets the correct CSP automatically. If it's called, the app is safe.

5. **Check for `X-Frame-Options` as a fallback.** Some apps use
   `X-Frame-Options: ALLOW-FROM https://admin.shopify.com` instead of
   CSP `frame-ancestors`. This is deprecated but functional in some
   browsers. Note it but don't flag if CSP is also present.

## What to report

For embedded apps with no `frame-ancestors` directive:

```json
{
  "file": "app/root.tsx",
  "line": 1,
  "message": "Embedded app has no frame-ancestors CSP directive — any origin can iframe it",
  "evidence": [
    { "file": "shopify.app.toml", "line": 5, "quote": "app_embed = true" },
    {
      "file": "app/root.tsx",
      "line": 1,
      "quote": "no addDocumentResponseHeaders or CSP header found"
    }
  ],
  "confidence": "medium",
  "reasoning": "The app declares app_embed capability but no file sets a Content-Security-Policy with frame-ancestors. Without it, any website can iframe the app."
}
```

Do not report:

- Non-embedded apps (no app_embed or theme_app_extension)
- Apps that call `addDocumentResponseHeaders` (handles CSP automatically)
- Apps with an explicit `frame-ancestors` directive in their CSP
- Test files (under test/ or \*\_test.rb)
