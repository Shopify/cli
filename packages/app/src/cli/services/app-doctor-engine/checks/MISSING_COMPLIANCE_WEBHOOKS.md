---
id: MISSING_COMPLIANCE_WEBHOOKS
version: 1
severity: medium
---

# Missing Compliance Webhooks

Inspect the selected `shopify.app*.toml` file. If it could not be parsed, keep the check unresolved. Verify all three compliance topics (`shop/redact`, `customers/data_request`, `customers/redact`) are declared in that configuration. Report only a confirmed missing topic.
