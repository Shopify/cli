---
id: INSECURE_WEBHOOK_URL
version: 2
severity: high
---

# Insecure Configured Callback Url

Inspect webhook destinations and OAuth redirect URLs in every unresolved Shopify app configuration. Relative Shopify paths and valid pubsub/eventbridge webhook destinations are allowed. Report HTTP, malformed, credential-bearing, wildcard-host, wildcard-path, or otherwise unsafe configured callback URLs.
