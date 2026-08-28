---
id: SCOPE_OVER_REQUEST
version: 1
tier: agentic
severity: high
---

Find cases where an app requests OAuth scopes it does not use, or uses
scopes in ways that exceed what the merchant authorised.

When a merchant installs an app, they grant a set of access scopes (e.g.
`read_orders`, `write_products`). The app should only access data covered
by those scopes. Two risks:

1. **Over-requested scopes:** the app declares scopes in its config that it
   never references in code. This is a privacy violation — the merchant
   granted access to data the app doesn't need.

2. **Under-verified usage:** the app calls an API endpoint that requires a
   scope, but doesn't check that the scope was granted before making the
   call. This can fail at runtime or, worse, access data the merchant
   didn't authorise if the scope was added by a different code path.

## What to look for

1. **Find the declared scopes.** Look in `shopify.app.toml` under
   `[access_scopes]` → `scopes`, or in the app's OAuth redirect URL, or
   in environment variables like `SCOPES`.

2. **Find where scopes are used.** Search for API calls that reference
   Shopify resources: `admin.rest.get`, `admin.graphql`, REST resource
   classes, GraphQL queries on `orders`, `products`, `customers`, etc.

3. **Match scopes to usage.** Each scope should map to at least one API
   call:
   - `read_orders` → queries on orders
   - `write_products` → mutations on products
   - `read_customers` → queries on customers
   - etc.

4. **Flag scopes with no matching usage.** If `read_analytics` is declared
   but no code references analytics, that's an over-requested scope.

5. **Flag API calls with no matching scope.** If code queries customers
   but `read_customers` isn't declared, that's an under-verified usage.

## What to report

```json
{
  "file": "shopify.app.toml",
  "line": 10,
  "message": "Scope 'read_analytics' is declared but never referenced in app code",
  "evidence": [
    {
      "file": "shopify.app.toml",
      "line": 10,
      "quote": "scopes = \"read_orders,read_analytics\""
    }
  ],
  "confidence": "medium",
  "reasoning": "Searched all source files for 'analytics' and found no API calls referencing analytics endpoints or resources."
}
```

For under-verified usage, report the code location, not the TOML:

```json
{
  "file": "app/services/customer_export.rb",
  "line": 15,
  "message": "Queries customers but 'read_customers' is not in declared scopes",
  "evidence": [
    {
      "file": "app/services/customer_export.rb",
      "line": 15,
      "quote": "Customer.all"
    },
    {
      "file": "shopify.app.toml",
      "line": 10,
      "quote": "scopes = \"read_orders\""
    }
  ],
  "confidence": "high"
}
```

Note: if the app has zero source files (config-only app), do not report
over-requested scopes — you cannot verify usage from an empty corpus.
