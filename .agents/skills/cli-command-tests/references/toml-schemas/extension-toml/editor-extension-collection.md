# `editor_extension_collection`

## Current full locally visible schema

```text
EditorExtensionCollection := Base & {
  name: string
  type: "editor_extension_collection"
  handle?: Handle
  uid?: UID

  # Both forms are accepted and concatenated.
  include?: Array<{ handle: string }>
  includes?: string[]
}
```

The local transform combines both forms:

```text
inCollection = [
  ...(includes ?? []).map(handle => ({handle})),
  ...(include ?? [])
]
```

## Structural versions

### EC0 — object include entries (2024-03-12)

```toml
[[extensions]]
type = "editor_extension_collection"

[[extensions.include]]
handle = "checkout-extension-handle"
```

The first local schema used object entries. The CLI still accepts them.

### EC1 — localization and validation (2024-04-15 to 2024-04-23)

`name` gained translation support. Validation began checking collection membership and supported extension families. The TOML structure did not change.

### EC2 — UID (2024-05-21 template)

Generated collections gained `uid`.

### EC3 — string `includes` (2025-05-07)

Added the current compact public form:

```toml
includes = ["checkout-handle", "customer-account-handle"]
```

The CLI deliberately accepts and merges EC0 and EC3. An `up` migration should replace `include` with `includes`.

## Cross-source differences

- Public docs show only `includes` and require at least two members.
- The checked-out template initializes `includes = []`, which is scaffold state and not deploy-valid according to docs.
- Local Zod itself does not enforce the public minimum; later validation/runtime contract does.

## E2E fixtures

Cover:

- EC0 alone
- EC3 alone
- both forms together, including their order
- duplicate handles
- an empty list
- one member
- two valid members
- an unsupported extension type
- configs before and after UID

## Sources

- `packages/app/src/cli/models/extensions/specifications/editor_extension_collection.ts`
- [Editor extension collection configuration](https://shopify.dev/docs/apps/build/customer-accounts/editor-extension-collections/configuration)
- `editor-extension-collection/shopify.extension.toml.liquid`
