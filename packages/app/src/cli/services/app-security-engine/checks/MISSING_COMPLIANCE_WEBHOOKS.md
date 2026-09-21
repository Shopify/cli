---
id: MISSING_COMPLIANCE_WEBHOOKS
version: 1
severity: medium
---

# Missing Compliance Webhooks

Inspect every `shopify.app*.toml` file that could not be parsed. Verify all three compliance topics (`shop/redact`, `customers/data_request`, `customers/redact`) are declared in each deployable configuration. Report only a confirmed missing topic.
