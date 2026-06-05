---
'@shopify/cli-kit': patch
---

Removed the `jose` dependency from `@shopify/cli-kit` by inlining guarded JWT payload decoding for session user ID extraction. The session exchange path now validates token structure and payload shape before reading `sub`, including malformed-token handling in tests.
