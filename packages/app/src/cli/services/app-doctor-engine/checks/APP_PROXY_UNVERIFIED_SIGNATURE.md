---
id: APP_PROXY_UNVERIFIED_SIGNATURE
version: 1
tier: agentic
severity: high
---

Find app proxy endpoints that read proxy parameters without verifying
the Shopify signature, allowing an attacker to impersonate Shopify and
send fake proxy requests.

App proxies let an app serve content directly on the merchant's store
via a URL like `https://shop.example.com/apps/my-app/proxy`. Shopify
signs every proxy request with an HMAC using the app's shared secret.
If the app doesn't verify this signature, anyone can send requests to
the proxy endpoint with forged parameters — including `shop`,
`logged_in_customer_id`, and `path_prefix`.

## What to look for

1. **Find app proxy route handlers.** These are endpoints configured as
   app proxies in `shopify.app.toml` under `[app_proxy]` or in the app's
   routing config. They typically read parameters like:
   - `shop` or `shop_id`
   - `logged_in_customer_id`
   - `path_prefix`
   - `signature`
   - `timestamp`

2. **Check for signature verification.** The handler must verify the
   HMAC signature before trusting any proxy parameter. Look for:
   - **Remix:** `authenticate.public.appProxy(request)` — the official
     verification function
   - **Rails:** `verified_request?` or manual HMAC verification using
     `ShopifyApp` utilities
   - **Express:** Manual HMAC verification using the app secret
   - **PHP:** `ShopifyUtils::verifyProxyRequest()` or equivalent

3. **If no verification is present, check whether the handler:**
   - Reads `shop` from the query string and uses it to scope data
   - Reads `logged_in_customer_id` and uses it for authorisation
   - Returns any shop-specific data

   If any of these are true and there's no signature check, it's a real
   finding.

4. **Check for the HMAC pattern even if the function name isn't obvious.**
   Some apps implement custom verification:
   - `crypto.createHmac('sha256', API_SECRET)`
   - `OpenSSL::HMAC.digest`
   - `hash_hmac('sha256', ...)`
   - Comparison with `timingSafeEqual` or `secure_compare`

## What to report

For each proxy handler that reads shop/customer parameters without
signature verification:

```json
{
  "file": "app/routes/proxy.ts",
  "line": 15,
  "message": "App proxy handler reads shop parameter without signature verification",
  "snippet": "const shop = url.searchParams.get('shop')",
  "evidence": [
    {
      "file": "app/routes/proxy.ts",
      "line": 15,
      "quote": "const shop = url.searchParams.get('shop')"
    },
    {
      "file": "app/routes/proxy.ts",
      "line": 1,
      "quote": "no authenticate.public.appProxy or HMAC verification found"
    }
  ],
  "confidence": "high",
  "reasoning": "The handler reads the shop parameter from the query string and uses it to query shop data, but no signature verification is present. An attacker can send requests with any shop parameter."
}
```

Do not report:

- Handlers that call `authenticate.public.appProxy(request)` (Remix)
- Handlers with manual HMAC verification
- Handlers that return only static content (no shop-specific data)
- Test handlers
