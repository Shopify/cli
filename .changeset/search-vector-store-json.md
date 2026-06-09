---
'@shopify/cli': minor
---

`shopify search` now queries the shopify.dev vector store and prints the most relevant documentation chunks as JSON to stdout, instead of opening a browser. This makes it usable for programmatic and agent-driven discovery. The `query` argument is now required, and two new optional filters are available: `--api-name` (for example `admin`, `storefront`, `hydrogen`) and `--api-version` (for example `2025-10`, `latest`, `current`). To download a full document verbatim, use `fetch-doc`.
