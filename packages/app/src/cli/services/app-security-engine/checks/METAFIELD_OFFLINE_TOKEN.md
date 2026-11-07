---
id: METAFIELD_OFFLINE_TOKEN
version: 2
severity: high
---

# Metafield Offline Token

Trace metafield and metaobject writes and determine their token provenance. Report a write that runs in an offline Admin API context that no verified request for the same shop authorizes: for example `unauthenticated.admin(shop)` or a stored offline session reached from an unauthenticated route, an unverified webhook or app proxy request, or a job whose shop or values come from request-controlled input.

An offline session returned by `authenticate.admin(request)` (the React Router SDK default when `useOnlineTokens` isn't set) is a verified, shop-bound context: Shopify verified the session token and the staff member's access to the app. Don't report a write only because its token is offline or because an online token would add user attribution or expiry. Report it when:

- the app defines its own per-user permission, for example an app-level role or allowlist check, and this write bypasses it. Name that permission.
- request-controlled values reach an app-reserved (`$app`) metafield or metaobject that the app treats as trusted state and merchants can't edit themselves, for example a definition with `access.admin = "merchant_read"` or no merchant access, or billing, entitlement or feature-flag data. Writing to the `$app` namespace isn't safe by itself.

Confirm token provenance and compensating authorization before reporting.
