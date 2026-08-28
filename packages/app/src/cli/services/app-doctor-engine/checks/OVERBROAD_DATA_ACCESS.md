---
id: OVERBROAD_DATA_ACCESS
version: 1
tier: agentic
severity: medium
---

Find cases where an app returns more data than necessary in API
responses, exposing sensitive information that the caller doesn't need.

Overbroad data access is a privacy risk: returning full customer records
when only an order status is needed, exposing PII (email, phone, address)
in error messages, or selecting all fields in a GraphQL query when only
a subset is required. This is how information disclosure happens in
practice — not through a single vulnerability, but through
carelessly broad data returns.

## What to look for

1. **Find API response patterns.** Search for:
   - Rails: `render json: @orders`, `render json: order`,
     `respond_with @resource`, `as_json`
   - Remix: `return json(data)`, `return Response(data)`
   - GraphQL: query resolvers that return full objects
   - Any serialization that includes all model fields

2. **Check what fields are returned.** For each API response:
   - Does it return the full model (all columns) or a filtered set?
   - Does it include sensitive fields like:
     - `email`, `phone`, `address`, `name` (PII)
     - `api_key`, `access_token`, `secret` (credentials)
     - `shop_id`, `tenant_id` (internal identifiers)
     - `password`, `password_digest` (auth data)
   - Is there a serializer or field selection that limits the output?

3. **Find GraphQL over-selection.** Search for:
   - Queries that select all fields: `query { products { ...AllFields } }`
   - Queries without field selection: `query { orders }` (returns everything)
   - Mutations that return the full object after creation/update

4. **Check error messages for information disclosure.** Search for:
   - Error responses that include stack traces
   - Error messages that reveal internal paths (`/app/services/...`)
   - Error messages that include database details (table names, column names)
   - Debug endpoints that expose app configuration

5. **Check for missing field-level authorization.** Even if the caller
   can access the resource, should they see all fields?
   - A merchant can see their orders, but should they see internal
     `cost` or `profit_margin` fields?
   - A customer can see their order, but should they see the merchant's
     internal notes?

## What to report

For each response that returns sensitive data unnecessarily:

```json
{
  "file": "app/controllers/api/orders_controller.rb",
  "line": 20,
  "message": "API response returns full order including customer PII",
  "snippet": "render json: @order",
  "evidence": [
    {
      "file": "app/controllers/api/orders_controller.rb",
      "line": 20,
      "quote": "render json: @order"
    },
    {
      "file": "app/models/order.rb",
      "line": 15,
      "quote": "has_many :line_items (includes customer email and shipping address)"
    }
  ],
  "confidence": "medium",
  "reasoning": "The response serializes the full order model including related customer PII (email, phone, address). No field selection or serializer limits the output. The caller only needs order status, but receives the customer's personal information."
}
```

Do not report:

- Responses with explicit field selection (serializers, `only:`, `except:`)
- Responses that return only public/non-sensitive fields
- Admin-only endpoints where full data access is intended
- Internal diagnostic endpoints behind staff auth
- Test files (under test/ or \*\_test.rb)
