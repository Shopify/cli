---
id: COMMITTED_SECRET
version: 2
severity: high
---

# Committed Secret

Inspect files skipped by deterministic secret scanning for committed credentials. Never quote or reproduce a secret; cite only the file and redacted credential kind, and recommend rotation.

Do not report placeholders, public client identifiers (`SHOPIFY_API_KEY`, Stripe `pk_`), or files git confirms are untracked and ignored. Template env files (`.env.example`, `.sample`, `.template`, `.dist`) are findings only when they contain a known credential format.
