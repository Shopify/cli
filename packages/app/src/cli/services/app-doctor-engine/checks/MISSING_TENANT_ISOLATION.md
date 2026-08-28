---
id: MISSING_TENANT_ISOLATION
version: 3
tier: agentic
severity: high
---

Find controller actions where a database query can read or modify a row
belonging to a shop other than the one making the request.

This is a multi-tenant app: every merchant's data must be isolated by
shop. A query that doesn't filter on the current shop is a cross-tenant
leak. Static analysis can't catch these reliably because the scoping is
often indirect — applied by a `before_action`, inherited from a parent
controller, or baked into a default scope on the model. Your job is to
follow those threads.

## What to look for

Search for ActiveRecord queries that filter on a column other than
`shop_id` / `shop`, or that take no tenant filter at all:

```ruby
Product.where(id: params[:id])
Order.where(shopify_id: params[:order_id])
Token.where(shop_id: params[:shop_id]).delete_all
```

The last one looks scoped but isn't — `params[:shop_id]` comes from the
request, not from the authenticated session. The caller can pass any
shop's id.

## How to investigate each candidate

1. **Read the enclosing method and the whole controller.** The scope may
   be applied on an adjacent line, or the flagged line may be a fragment
   of a longer chain (`.or(...)`, `.merge(...)`) whose base scope is above.

2. **Follow the receiver.** If the query is on a variable rather than a
   model constant, find where it comes from. A relation passed in as a
   method parameter may already be scoped by its caller — go look.

3. **Read the controller's ancestors.** Authentication and tenant scoping
   are usually inherited: `before_action`, `around_action`, a mixin, or a
   parent class. Follow the chain to the top before concluding there's no
   protection.

4. **Check whether the model is tenant-scoped at all.** Read the model and
   its schema. If the table has no shop/tenant column, there is nothing to
   scope by. Global reference or catalog tables are a correct design.

5. **Consider whether cross-tenant access is the deliberate purpose.**
   Some queries exist to resolve which tenant owns a resource. Scoping
   those by tenant is circular. If so, the risk is enumeration, not
   isolation — note it but don't report it under this check.

6. **Check for an explicit opt-out** like `skip_idor_protection`. That
   tells you the author considered it. Decide whether their reasoning
   holds — an unguessable capability token is a real control; a sequential
   integer id is not.

## What to report

For each genuine cross-tenant risk you find, report:

```json
{
  "file": "app/controllers/...",
  "line": 42,
  "message": "Query on Product is not scoped to the current shop",
  "snippet": "Product.where(id: params[:id])",
  "evidence": [
    { "file": "path", "line": 12, "quote": "the line that shows the gap" }
  ],
  "confidence": "high",
  "reasoning": "what you read and why it's a real risk"
}
```

Be precise about the gap. "No shop filter" is not enough — explain where
the scoping _should_ have come from and why it's missing. If you read a
file and it turns out the query IS scoped, don't report it. You are not
trying to find problems — you are trying to find the real ones.

Every finding must cite at least one file and line you actually read.
An finding with no evidence is not a finding.
