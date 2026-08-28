---
id: UNAUTHENTICATED_ENDPOINT
version: 2
tier: agentic
severity: high
---

Find controller actions or route handlers that process requests without
verifying the caller's identity or authority.

An unauthenticated endpoint in a Shopify app is one where a request from
outside the merchant's session — another app, a scraper, an attacker — can
reach a handler that reads or modifies shop data. Authentication in Shopify
apps comes in several forms, and the right one depends on the entry point:

- **Embedded app pages** use `authenticate.admin(request)` (Remix) or
  `ShopifyApp::EnsureHasSession` (Rails). The session is validated by a
  JWT or session cookie.
- **Webhooks** are verified by HMAC signature
  (`ShopifyApp::WebhookVerification`, `@shopify/webhook-processer`).
- **App proxies** are verified by signature query parameters.
- **Service-to-service** endpoints use bearer tokens or mTLS.

A handler is unauthenticated if none of these apply AND the handler
accesses shop-scoped data. A public endpoint that returns static content
is not a finding.

## What to look for

1. **Find every route handler.** In Rails, these are controller actions
   (methods in a controller class). In Remix/Express, these are loader
   and action exports, or route handlers. In PHP, these are controller
   methods or route closures.

2. **For each handler, check whether authentication is applied.** Look for:
   - A `before_action` / `beforeAction` / middleware that validates the
     session (often inherited from a parent controller — follow the chain)
   - An `authenticate.admin(request)` call in a Remix loader/action
   - An HMAC verification for webhook/proxy endpoints
   - A bearer token check for service endpoints

3. **Follow inheritance.** A controller with no visible `before_action`
   may inherit one from `ApplicationController` or a parent. Read the
   parent class before flagging.

4. **Check for `skip_idor_protection` or `protect_from_forgery` exceptions.**
   These are explicit opt-outs — the author chose to skip a protection.
   Determine whether the remaining auth (if any) is sufficient.

5. **Check for the try/catch fallback pattern:**
   ```js
   try {
     authenticate.admin(request);
   } catch {
     url.searchParams.get("shop");
   }
   ```
   This looks authenticated but falls back to user input on failure — the
   catch block bypasses auth entirely. This is a real finding.

## What to report

For each genuinely unauthenticated handler that accesses shop data:

```json
{
  "file": "app/controllers/...",
  "line": 42,
  "message": "Controller action processes shop data with no auth verification",
  "snippet": "def export\n  Order.all.to_csv\nend",
  "evidence": [
    { "file": "path", "line": 12, "quote": "the line showing no auth" },
    {
      "file": "path",
      "line": 5,
      "quote": "class FooController < ApplicationController (no before_action in parent)"
    }
  ],
  "confidence": "high",
  "reasoning": "why this handler is reachable without authentication"
}
```

Do not report:

- Public endpoints that return static content (health checks, app metadata)
- Handlers protected by inherited `before_action` (verify the parent first)
- Webhook/proxy handlers with HMAC verification
- Test controllers or development-only routes

Every finding must cite the file and line where you determined auth is
absent. If you couldn't read the parent controller, say so — do not assume
auth is missing.
