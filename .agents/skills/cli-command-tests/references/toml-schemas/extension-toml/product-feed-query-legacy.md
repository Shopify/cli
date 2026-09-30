# Legacy `product_feed_query`

The experimental template used this shape:

```text
ProductFeedQuery := {
  type: "product_feed_query"
  handle: Handle
  name: string
  uid?: UID
  product_fragment_graphql: string
  variant_fragment_graphql: string
}
```

## Versions and migration

- **PFQ0 — 2025-05-29:** introduced in a spike with multiline GraphQL fragments.
- **PFQ1 — same-day naming update:** final deleted template retained the two fragment properties.

No current local specification, public configuration page, or template exists. Treat these files as contract-only legacy data. Do not invent a local canonical rewrite. Use E2E fixtures to check both the release that exposed the template and the current CLI’s unknown-type error.

## Sources

- deleted `product-feed-query` template
- commits `1b0f2d6` and `db22728`
