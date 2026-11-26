---
id: WEAK_SHOP_VALIDATION
version: 2
severity: high
precedence: prefer-agent
---

# Weak Shop Validation

Inspect shop-domain validation across aliases and helpers. Report validation that accepts attacker-controlled domains because it is unanchored or otherwise fails to enforce the exact permitted Shopify hostname form.

The deterministic implementation covers the direct forms, when the checked value is a shop value: a `myshopify.com` regex, or a `RegExp("…myshopify.com…")` string, used with `test`, `exec`, `match`, or `search`, that doesn't require the dot before `myshopify.com` or doesn't anchor the end of the hostname in every alternative; an `includes('myshopify.com')` check, with or without the leading dot; and an `endsWith('myshopify.com')` check without the dot before `myshopify.com`. It doesn't follow aliases, wrappers, or derived comparisons. Report those semantic cases too, and keep the finding focused on a check that decides whether a request-supplied shop domain is a genuine `<shop>.myshopify.com` host: requiring the dot and the end of the host, as in `/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/`, `/\.myshopify\.com$/`, `shop.endsWith('.myshopify.com')`, or `shop.endsWith('example.myshopify.com')`, is accepted, and a check on a value that never reaches a shop trust boundary is not a finding.
