---
'@shopify/app': patch
'@shopify/cli': patch
---

Stop `shopify app security check` from flagging inert schema-typed app block settings (checkbox, range, and select/radio with safe option values) under LIQUID_UNSAFE_RENDER when they render as element text or safe quoted attributes
