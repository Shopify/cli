---
id: UNSCOPED_SHOP_CONFIG_WRITE
version: 1
tier: agentic
severity: high
---

Find configuration writes where the target shop is determined by request
input rather than the authenticated session, allowing an attacker to
modify another shop's configuration.

Some apps write per-shop configuration — metafields, app settings,
webhook subscriptions. The target shop must come from the authenticated
session, not from the request body or query string. If an attacker can
control the target shop, they can write to another merchant's config.

## What to look for

1. **Find configuration write calls.** Search for:
   - GraphQL mutations: `metafieldsSet`, `metafieldUpdate`, `appUpdate`,
     `webhookSubscriptionCreate`, `webhookSubscriptionUpdate`
   - REST writes: `admin.rest.put`, `admin.rest.post`
   - Rails: `.save`, `.update`, `.create` on config models
   - Any write that takes a shop identifier as a parameter

2. **Trace the shop identifier.** For each write, determine where the
   target shop comes from:
   - `params[:shop_id]`, `request.body.shop`, `url.searchParams.get('shop')`
     — request input, attacker-controlled
   - `session.shop`, `current_shop.shop_id`, `authenticate.admin(request)`
     — session-derived, safe
   - A variable — trace it back

3. **Check for session verification.** Is `authenticate.admin(request)`
   called in this handler? Is there a `before_action` that establishes
   the session? If the shop comes from the session, it's safe.

4. **Check the Remix pattern.** In Remix apps, the admin context comes
   from `authenticate.admin(request)`, which returns `{ admin, session }`.
   The shop is `session.shop`. If code instead reads `shop` from the
   request body and passes it to `unauthenticated.admin(shop)`, that's
   the vulnerability — `unauthenticated.admin` doesn't verify the caller.

## What to report

```json
{
  "file": "app/routes/api.update-settings.ts",
  "line": 20,
  "message": "Configuration write targets shop from request body without session verification",
  "snippet": "const shop = await request.json().then(d => d.shop)",
  "evidence": [
    {
      "file": "path",
      "line": 20,
      "quote": "const shop = await request.json().then(d => d.shop)"
    },
    {
      "file": "path",
      "line": 25,
      "quote": "await admin.rest.put({ path: 'metafields', shop })"
    },
    {
      "file": "path",
      "line": 1,
      "quote": "no authenticate.admin(request) call found"
    }
  ],
  "confidence": "high",
  "reasoning": "The target shop comes from the request body and is passed to a configuration write. No session verification is present, so an attacker can write to any shop's config."
}
```

Do not report:

- Writes where the shop comes from `authenticate.admin(request)` session
- Writes where the shop comes from an HMAC-verified webhook payload
- Test handlers
