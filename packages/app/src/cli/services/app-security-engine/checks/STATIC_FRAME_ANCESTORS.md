---
id: STATIC_FRAME_ANCESTORS
version: 2
severity: high
precedence: prefer-agent
---

# Static Frame Ancestors

Inspect embedded-app Content-Security-Policy construction, including headers that app code sets after or instead of the SDK's. Report wildcard or static cross-shop frame-ancestors policies, such as `*`, `https:`, `*.myshopify.com`, or a fixed list of shop domains, whether the value is written literally or built from variables. Accept a policy derived safely for the shop plus Shopify Admin.

The React Router SDK's `addDocumentResponseHeaders` (from `shopifyApp()`, usually called in `entry.server`) is the accepted pattern: it sets `frame-ancestors` to the sanitized request shop plus Shopify Admin origins, including Shopify-operated development admin origins. Don't report it unless app code overrides or extends its header.
