---
'@shopify/cli-kit': patch
---

Theme commands now retry Admin API requests that fail with a temporary server error (`INTERNAL_SERVER_ERROR`, 502, 503 or 504), up to 3 times with backoff. If the error persists, they show a friendly "try again" message with the request ID instead of the raw API response. Mutations are never retried.
