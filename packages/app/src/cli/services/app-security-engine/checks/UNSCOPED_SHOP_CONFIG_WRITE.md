---
id: UNSCOPED_SHOP_CONFIG_WRITE
version: 2
severity: high
---

Find configuration writes where the target shop is determined by an
untrusted or insufficiently bound selector instead of the authenticated
installation/session, allowing an attacker to modify another shop's
configuration.

Some apps write per-shop configuration — metafields, app settings,
webhook subscriptions. The target shop must come from the authenticated
installation/session or be re-bound to it before the write. Request input,
raw headers, cache keys, background-job payloads, token-exchange artifacts,
and persisted values whose provenance is not bound are all suspect.

## What to look for

1. **Find configuration write calls.** Search for:
   - GraphQL mutations: `metafieldsSet`, `metafieldUpdate`, `appUpdate`,
     `webhookSubscriptionCreate`, `webhookSubscriptionUpdate`
   - REST writes: `admin.rest.put`, `admin.rest.post`
   - Rails: `.save`, `.update`, `.create` on config models
   - Any write that takes a shop identifier as a parameter

2. **Trace the shop selector.** For each write, determine where the target
   shop comes from:
   - `params[:shop_id]`, `request.body.shop`, `url.searchParams.get('shop')`
     — request input, attacker-controlled
   - Raw headers, cache keys, background-job payloads, token-exchange artifacts,
     or persisted values whose original source was lower trust
   - `session.shop`, `current_shop.shop_id`, `authenticate.admin(request)`, or a
     reloaded installation/session record — trusted
   - A variable — trace it back to the first trusted or untrusted source

3. **Check for session verification or rebinding.** Is `authenticate.admin(request)`
   called in this handler? Is there a `before_action` that establishes the
   session? Does a job/controller load a trusted installation record and ignore
   the raw selector after rebinding? If so, the write may be safe.

4. **Check the Remix pattern.** In Remix apps, the admin context comes
   from `authenticate.admin(request)`, which returns `{ admin, session }`.
   The shop is `session.shop`. If code instead reads `shop` from the
   request body and passes it to `unauthenticated.admin(shop)`, that's
   the vulnerability — `unauthenticated.admin` doesn't verify the caller.

## What to report

Report only when the write target is both attacker-influenceable and not
revalidated before the write:

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
  "reasoning": "The target shop comes from the request body and is passed to a configuration write. No session verification or rebinding is present, so an attacker can write to another shop's config."
}
```

If provenance is unclear, keep the check unresolved instead of reporting a finding.

Do not report:

- Writes where the shop comes from `authenticate.admin(request)` session
- Writes where the shop comes from an HMAC-verified webhook payload
- Writes where a raw header, job payload, cache key, or stored selector is re-bound
  to a trusted installation/session before the write
- Values whose provenance is unclear but not demonstrably attacker-controlled
- Test handlers
