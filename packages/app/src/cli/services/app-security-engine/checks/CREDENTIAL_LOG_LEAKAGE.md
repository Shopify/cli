---
id: CREDENTIAL_LOG_LEAKAGE
version: 3
severity: high
precedence: prefer-agent
---

# Credential Log Leakage

Trace credentials, access tokens, session tokens, and client secrets through aliases and helpers to console, logger, telemetry, or error-reporting sinks. Do not report boolean presence checks, deliberate redaction, or one-way hashes. Verify by reading code only: do not execute app, SDK, test, or repro code, and do not make network calls or probe live stores or services to prove a finding.
