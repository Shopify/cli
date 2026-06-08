---
'@shopify/cli-kit': patch
---

Remove `json-schema-ref-parser` from `@shopify/cli-kit` by replacing its internal-only `$ref` dereferencing with a local JSON Pointer resolver that preserves cyclic refs safely for Ajv validation.
