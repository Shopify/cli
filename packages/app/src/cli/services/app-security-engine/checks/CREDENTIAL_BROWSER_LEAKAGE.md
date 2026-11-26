---
id: CREDENTIAL_BROWSER_LEAKAGE
version: 3
severity: high
precedence: prefer-agent
---

# Credential Browser Leakage

Trace credentials, access tokens, session tokens, and client secrets into loader/HTTP responses, browser globals, DOM values, client bundles, or external requests. Do not report server-only use or safe boolean/redacted/hash-derived values. Verify by reading code only: do not execute app, SDK, test, or repro code, and do not make network calls or probe live stores or services to prove a finding.
