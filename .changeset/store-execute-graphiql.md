---
'@shopify/cli-kit': minor
'@shopify/app': minor
'@shopify/store': minor
---

Open an interactive GraphiQL UI when running `shopify store execute` without `--query` or `--query-file`. The GraphiQL session uses the access token previously set up via `shopify store auth`, points at the same Admin GraphQL endpoint as the non-interactive mode, and respects `--allow-mutations` (mutations are blocked by default). The GraphiQL HTTP server has moved into `@shopify/cli-kit/node/graphiql/server` so both `shopify app dev` and `shopify store execute` can reuse it; behavior of `shopify app dev` is unchanged.
