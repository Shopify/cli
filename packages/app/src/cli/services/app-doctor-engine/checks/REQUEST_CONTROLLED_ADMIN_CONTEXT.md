---
id: REQUEST_CONTROLLED_ADMIN_CONTEXT
version: 2
severity: high
---

# Request Controlled Admin Context

Trace direct, destructured, aliased, cached, persisted, or job-carried shop selectors into `unauthenticated.admin(...)` or `unauthenticated.storefront(...)`. Treat request params, raw headers, token-exchange artifacts, cache keys, and background-job payloads as untrusted unless the code re-binds them to the verified installation/session context. A preceding `authenticate.admin(request)` call does not sanitize an independently derived selector. Report only when the selector provenance is proven untrusted or unbound; if provenance is unclear, keep the result unresolved instead of inventing a finding.
