# Legacy `channel_specification`

The original contract-based channel template bundled files from `specifications/`:

```text
LegacyChannelSpecification := {
  type: "channel_specification"
  name?: string
  description?: string
  handle?: Handle
  # additional fields were owned by the runtime contract
}
```

## Versions and migration

- **CS0 — 2025-01-24:** introduced `channel_specification`.
- **CS1 — 2025-08/09:** renamed to `channel_config`; file asset behavior remained.

Change the type to `channel_config`, then validate against the current fetched contract. Preserve every contract-owned property and all assets under `specifications/`.

## Sources

- deleted `channel-specification` template history
- [Current channel config](channel-config.md)
