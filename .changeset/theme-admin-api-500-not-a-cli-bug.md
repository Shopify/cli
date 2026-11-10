---
'@shopify/cli-kit': patch
---

Theme commands now report an HTTP 500 from the Admin API as a problem on the Shopify side, with the request ID when the response has one, instead of crashing with the raw GraphQL error. `fetchTheme` no longer treats an HTTP 500 as a missing theme.
