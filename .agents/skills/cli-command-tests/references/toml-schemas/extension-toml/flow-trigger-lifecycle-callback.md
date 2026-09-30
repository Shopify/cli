# `flow_trigger_lifecycle_callback`

The CLI checkout validates this type only through a runtime contract. Public docs and the generated template define the public schema:

```text
FlowTriggerLifecycleCallback := {
  name: string
  handle: Handle
  type: "flow_trigger_lifecycle_callback"
  uid: UID
  url: HTTPS URL
}
```

Define the config as an entry in `[[extensions]]`.

## Structural versions

- **FLC0 — introduced 2024-10-21:** initial template had the same five fields. No later accepted structural version was found in the checked-out CLI branch or template history.

An unmerged CLI branch explored app-relative lifecycle URLs. That branch is not an ancestor of this checkout, and the public contract still requires HTTPS, so this inventory does not count it as an accepted version.

## E2E fixtures

Cover:

- an absolute HTTPS URL
- HTTP URL rejection
- a malformed URL
- relative URL rejection
- a missing UID
- a duplicate handle

## Sources

- [Flow lifecycle configuration](https://shopify.dev/docs/apps/build/flow/track-lifecycle-events#configuration)
- `flow-trigger-lifecycle-callback/shopify.extension.toml.liquid` and its history
