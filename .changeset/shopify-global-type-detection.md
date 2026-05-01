---
'@shopify/app': patch
---

The CLI-generated `shopify.d.ts` now types the `shopify` binding as `Api & ShopifyGlobal` (intersection) for UI extension targets whose `.d.ts` re-exports a `ShopifyGlobal` type. Existing consumers who access the target API via `shopify.*` are unaffected; new host-level APIs like `shopify.addEventListener` now type-check automatically for opt-in targets (e.g. POS background extensions). Targets that do not re-export `ShopifyGlobal` emit the same output as before.
