---
id: CSRF_MISSING_PROTECTION
version: 1
tier: agentic
severity: medium
---

Find state-changing endpoints (POST, PUT, DELETE, PATCH) that don't
verify CSRF protection, allowing an attacker to forge requests on
behalf of an authenticated user.

CSRF (Cross-Site Request Forgery) occurs when an app accepts
state-changing requests without checking that the request came from
the app's own UI. In Shopify apps, embedded apps use session tokens
(JWT) that provide some CSRF protection, but server-rendered apps and
app proxies still need explicit CSRF checks.

## What to look for

1. **Find state-changing handlers.** Search for:
   - Rails: controller actions responding to POST/PUT/PATCH/DELETE
     (check `routes.rb` or controller method names like `create`,
     `update`, `destroy`)
   - Remix: `action` exports in route files
   - Express: `app.post()`, `app.put()`, `app.delete()`
   - PHP: form handlers, POST routes

2. **Check for CSRF protection on each.** Look for:
   - Rails: `protect_from_forgery` (default in Rails, but check for
     `skip_forgery_protection` or `protect_from_forgery with: :null_session`)
   - Remix: session token validation (`authenticate.admin(request)`)
   - Express: `csurf` middleware or equivalent
   - PHP: CSRF token in form, `VerifyCsrfToken` middleware

3. **Flag explicit opt-outs.** Search for:
   - `skip_forgery_protection` — disables CSRF entirely for a controller
   - `protect_from_forgery with: :null_session` — used for webhooks, but
     if on a non-webhook endpoint, CSRF is missing
   - `skip_before_action :verify_authenticity_token` — skips the Rails
     CSRF check

4. **Distinguish webhooks from user-facing endpoints.** Webhooks use
   HMAC verification instead of CSRF tokens — `protect_from_forgery
with: :null_session` is correct for webhooks. But the same pattern
   on a user-facing POST handler is a CSRF vulnerability.

5. **Check Shopify-specific patterns.** Embedded apps that use
   `authenticate.admin(request)` get session token validation that
   prevents CSRF. But if an action skips `authenticate.admin` and still
   processes state changes, CSRF protection may be missing.

## What to report

For each state-changing endpoint without CSRF protection:

```json
{
  "file": "app/controllers/settings_controller.rb",
  "line": 5,
  "message": "POST handler with CSRF protection disabled",
  "snippet": "skip_forgery_protection",
  "evidence": [
    {
      "file": "app/controllers/settings_controller.rb",
      "line": 5,
      "quote": "skip_forgery_protection"
    },
    {
      "file": "app/controllers/settings_controller.rb",
      "line": 10,
      "quote": "def update"
    }
  ],
  "confidence": "medium",
  "reasoning": "The update action accepts POST requests but CSRF protection is explicitly skipped. This is not a webhook handler (no HMAC verification), so an attacker can forge a POST request from another site."
}
```

Do not report:

- Webhook handlers with `protect_from_forgery with: :null_session`
  (HMAC is the CSRF protection for webhooks)
- Endpoints protected by `authenticate.admin(request)` (session
  token provides CSRF protection)
- GET-only handlers (not state-changing)
- API endpoints that use bearer token auth (not cookie-based, so
  CSRF doesn't apply)
- Test controllers
