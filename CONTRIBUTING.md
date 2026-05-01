# Contributing to Shopify CLI

## Changesets and versioning

This project uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs. Every user-facing change requires a changeset file.

```
pnpm changeset add
```

### Choosing the right bump type

The CLI follows [semantic versioning](https://semver.org). Pick the bump type that matches the nature of your change:

| Bump | When to use |
| :---- | :---- |
| `patch` | Bug fix that doesn't change any public interface |
| `minor` | New feature or behaviour that is backwards-compatible |
| `major` | Breaking change to a stable interface (see table below) |

### What counts as a breaking change

The following interfaces are **stable** — any incompatible change to them requires a `major` bump:

| Interface | Breaking change examples |
| :---- | :---- |
| **Command surface** | Removing a command or subcommand; renaming a flag; changing a flag's semantics |
| **Exit codes** | Changing the exit code for a given outcome |
| **Machine-readable output (`--json`)** | Removing or renaming a JSON key; changing a value's type |
| **Config file schema** (`shopify.app.toml`, etc.) | Removing a required key; changing a key's type |
| **Extension manifest schema** | Removing a field; changing validation rules that reject previously-valid manifests |
| **`@shopify/cli-kit` public API** | Removing or renaming a publicly exported function or type |
| **Documented environment variables** | Removing or renaming a documented env var |

Human-readable output (messages, spinner text, prompts) is **not** a stable interface. Changing wording or formatting is not a breaking change.

### Deprecation policy

Before removing or incompatibly changing a stable interface:

1. Mark it deprecated in the code and surface a runtime warning when it is used.
2. Ship the deprecation notice in a **minor** release — this starts the clock.
3. Wait at least one minor release cycle before removing it.
4. Ship the removal in a **major** release with a migration guide in the release notes.
