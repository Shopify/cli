---
'@shopify/cli-kit': patch
---

Partition the GraphQL response cache by a hash of the endpoint URL and access token. Existing cache entries are not reused, so each cached query is fetched again once.
