---
id: REQUEST_CONTROLLED_ADMIN_CONTEXT
version: 1
severity: high
---

# Request Controlled Admin Context

Trace direct, destructured, and aliased request-derived shop values into `unauthenticated.admin(...)`. A preceding `authenticate.admin(request)` call does not sanitize an independently request-derived value: report the flow unless the shop argument itself is derived from the verified authentication/session output. Inspect computed properties and helper calls when the deterministic handoff is ambiguous.
