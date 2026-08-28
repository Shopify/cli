---
id: MISSING_AUTHORIZATION_CHECK
version: 1
tier: agentic
severity: high
---

Find controller actions or route handlers that access resources without
checking whether the current user is authorized to access them, beyond
authentication. Authentication verifies WHO you are; authorization verifies
WHAT you can do. An app can be authenticated but still access resources
belonging to another merchant if authorization checks are missing.

This is distinct from `MISSING_TENANT_ISOLATION` (database query
scoping) — this check looks for missing policy/permission checks on
actions, even when the data access is scoped. For example, an app might
scope queries by shop but not check whether the merchant has the right to
delete a resource, or whether a staff member can access admin-only
actions.

## What to look for

1. **Find authorization frameworks.** Check what the app uses:
   - Rails: Pundit (`authorize`, `policy`, `Pundit`), CanCanCan
     (`can?`, `ability`), action_access filters
   - Remix/Express: middleware that checks roles/permissions
   - Custom: `before_action :check_admin`, `if current_user.can?`

2. **Find actions without authorization checks.** For each controller
   action or route handler, determine:
   - Is there a `before_action` that checks authorization (not just
     authentication)?
   - Is there a Pundit `authorize` call?
   - Is there a CanCanCan `authorize!` or `can?` check?
   - Is there a custom permission check?

3. **Check for `skip_idor_protection` or equivalent opt-outs.** These
   disable IDOR/authorization checks. For each, determine:
   - Is the skip justified? (e.g., public endpoint, webhook, health check)
   - Does the skip expose a state-changing action to unauthorised users?
   - Is there a compensating control (HMAC, session token, etc.)?

4. **Check for admin-only functionality reachable by merchants.** Look for:
   - Controllers under `admin/` namespace that don't check staff vs merchant
   - Actions that modify app configuration without checking the caller's role
   - Staff-only operations accessible through the merchant-facing UI

5. **Check for missing object-level authorization.** Even if the query
   is scoped by shop, does the handler verify that the specific resource
   belongs to the current merchant?
   - `Order.find(params[:id])` scoped by shop — but does it check the
     merchant can access this specific order?
   - `Product.find(params[:id])` — is there a policy check, or just
     tenant scoping?

## What to report

For each action that accesses resources without authorization checks:

```json
{
  "file": "app/controllers/orders_controller.rb",
  "line": 15,
  "message": "Destroy action has no authorization check beyond authentication",
  "snippet": "def destroy\n  Order.find(params[:id]).destroy\nend",
  "evidence": [
    {
      "file": "app/controllers/orders_controller.rb",
      "line": 15,
      "quote": "def destroy"
    },
    {
      "file": "app/controllers/orders_controller.rb",
      "line": 5,
      "quote": "before_action :authenticate_user (no authorize check)"
    }
  ],
  "confidence": "medium",
  "reasoning": "The destroy action authenticates the user but does not call authorize or check a policy. Any authenticated merchant can delete any order within their shop, even if they shouldn't have delete permissions."
}
```

Do not report:

- Actions with explicit `authorize` / `can?` / policy checks
- Actions protected by a `before_action` that checks authorization
- Public endpoints (health checks, static content)
- Webhook handlers (HMAC is the authorization)
- Actions that only read data the merchant owns (scoped by session.shop
  AND no object-level access control needed)
- Internal/staff-only controllers (under `Internal::` namespace, behind
  employee SSO like `EmployeeIdentity`, `IdentityClient`, etc.)
- Test files (under test/ or \*\_test.rb)
- Test controllers
