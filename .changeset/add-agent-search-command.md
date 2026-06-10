---
'@shopify/cli': minor
---

Add `shopify agent-search`, which queries the shopify.dev vector store and prints the most relevant documentation chunks as JSON to stdout. This makes it usable for programmatic and agent-driven discovery, and supports two optional filters: `--api-name` (for example `admin`, `storefront`, `hydrogen`) and `--api-version` (for example `2025-10`, `latest`, `current`). To download a full document verbatim, use `fetch-doc`.

`shopify search` is now deprecated. Its behavior is unchanged — it still opens shopify.dev in your browser — but it prints a deprecation notice pointing to `agent-search`.
