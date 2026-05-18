## 2025-05-15 - Redacting all Shopify tokens in analytics
**Vulnerability:** Shopify access tokens (shpat_, shpua_, shpca_) were not redacted from analytics payloads, only Theme Access tokens (shptka_).
**Learning:** Analytics payloads often contain serialized command arguments and metadata which can inadvertently include sensitive tokens if not explicitly sanitized.
**Prevention:** Use a broad regex pattern at the final sanitization boundary to capture all known token formats.
