# Legacy `product_sync_query`

The experimental template used this shape:

```text
ProductSyncQuery := {
  type: "product_sync_query"
  handle: Handle
  name: string
  uid?: UID
}
```

## Versions and migration

- **PSQ0 — 2025-05-29:** introduced and removed during the product-query spike. No additional public TOML fields were present in the last recoverable template.

No current local specification, public configuration page, or template exists. Preserve this as a historical unknown or remote-contract fixture. Do not map it to `product_feed_query` without platform evidence.

## Sources

- deleted `product-sync-query` template
- commits `1b0f2d6`, `db22728`, and `c5d6357`
