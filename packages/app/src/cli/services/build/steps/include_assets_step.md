# `include_assets` Build Step

Copies files into the extension output bundle and optionally generates a `manifest.json` that describes what was copied and where.

---

## Step config shape

```toml
[extensions.build.steps.include_assets]
generate_manifest = false   # optional, default false

[[extensions.build.steps.include_assets.inclusions]]
# one entry per file/directory group to copy — see inclusion types below
```

### Top-level fields

| Field | Type | Default | Description |
|---|---|---|---|
| `inclusions` | array | required | List of inclusion entries (see types below) |
| `generate_manifest` | boolean | `false` | When `true`, writes `manifest.json` to the output directory after all files are copied |

---

## Inclusion types

### `pattern` — glob-based selection

Selects files from a source directory using glob patterns.

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "pattern"
base_dir = "./assets"          # optional, defaults to extension root
include = ["**/*.json"]        # optional, defaults to ["**/*"]
ignore = ["**/node_modules"]   # optional
destination = "dist"           # optional subdirectory in the output bundle
preserve_structure = true      # optional, default true
```

| Field | Type | Default | Description |
|---|---|---|---|
| `base_dir` | string | extension root | Directory to glob from |
| `include` | string[] | `["**/*"]` | Glob patterns to include |
| `ignore` | string[] | — | Glob patterns to exclude |
| `destination` | string | — | Output subdirectory |
| `preserve_structure` | boolean | `true` | Keep relative paths from `base_dir` |

**Does not contribute to manifest.**

---

### `static` — explicit source path

Copies a single file or directory by explicit path.

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "static"
source = "./dist/bundle.js"   # required — path relative to extension root
destination = "assets"        # optional output subdirectory
preserve_structure = false    # optional, default false
```

| Field | Type | Default | Description |
|---|---|---|---|
| `source` | string | required | Path relative to extension root |
| `destination` | string | — | Output subdirectory. When omitted and `preserve_structure = false`, contents are merged into the output root |
| `preserve_structure` | boolean | `false` | Place the directory under its own name rather than merging |

**Does not contribute to manifest.**

---

### `configKey` — resolved from extension TOML config

Reads a path (or list of paths) from the extension's own TOML configuration and copies them. Silently skipped when the key is absent from the config.

Use `[]` in the key path to flatten arrays during resolution.

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "configKey"
key = "extensions[].targeting[].tools"   # dot-path with [] to flatten arrays
destination = "dist"                     # optional output subdirectory
preserve_structure = false               # optional, default false
anchor = "extensions[].targeting[]"     # optional — for manifest grouping
group_by = "target"                      # optional — for manifest grouping
```

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | string | required | Dot-path into the extension config. `[]` flattens arrays and collects all leaf values |
| `destination` | string | — | Output subdirectory |
| `preserve_structure` | boolean | `false` | Place source under its own name |
| `anchor` | string | — | Array path to iterate for manifest grouping. Must be set together with `group_by` |
| `group_by` | string | — | Property on each anchor item to use as the manifest key. Must be set together with `anchor` |

**Contributes to manifest.** (See [Manifest generation](#manifest-generation) below.)

> **Warning:** Setting only one of `anchor` / `group_by` logs a warning and the entry is treated as a root-level manifest entry instead.

---

## Manifest generation

When `generate_manifest = true`, the step writes a `manifest.json` to the output directory after all files have been copied.

Only `configKey` inclusions contribute to the manifest. `pattern` and `static` inclusions are ignored.

### Path resolution

Manifest paths are **output-relative** — they reflect where files actually landed in the output bundle, not the raw values from the config. This is tracked via the actual copy operations, so rename-on-conflict (see below) is always reflected correctly.

### Root-level entries

A `configKey` inclusion **without** `anchor`/`group_by` is written at the manifest root, keyed by the last segment of its `key` path:

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "configKey"
key = "extensions[].tools"
```

Given `extensions[0].tools = "./tools.json"` → copies the file → manifest entry:

```json
{
  "tools": "tools.json"
}
```

### Anchored entries (grouped)

When `anchor` and `group_by` are both set, the step iterates the array at the `anchor` path and groups manifest entries under each item's `group_by` field value. The `key` path is resolved relative to the anchor item.

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "configKey"
key = "extensions[].targeting[].tools"
anchor = "extensions[].targeting[]"
group_by = "target"
```

Extension config:

```toml
[[extensions.targeting]]
target = "admin.intent.link"
tools = "./tools.json"

[[extensions.targeting]]
target = "admin.order.action"
tools = "./order-tools.json"
```

Resulting `manifest.json`:

```json
{
  "admin.intent.link": {
    "tools": "tools.json"
  },
  "admin.order.action": {
    "tools": "order-tools.json"
  }
}
```

### Multiple inclusions per anchor

Multiple `configKey` entries sharing the same `anchor`/`group_by` are merged per group key:

```toml
[[extensions.build.steps.include_assets.inclusions]]
type = "configKey"
key = "extensions[].targeting[].tools"
anchor = "extensions[].targeting[]"
group_by = "target"

[[extensions.build.steps.include_assets.inclusions]]
type = "configKey"
key = "extensions[].targeting[].schema"
anchor = "extensions[].targeting[]"
group_by = "target"
```

```json
{
  "admin.intent.link": {
    "tools": "tools.json",
    "schema": "email-schema.json"
  }
}
```

### Rename on conflict

If two config entries resolve to files with the same name, the second copy gets a counter suffix (`-1`, `-2`, …) to avoid overwriting. The manifest reflects the actual output path:

```json
{
  "admin.intent.link": { "schema": "schema.json" },
  "admin.order.action": { "schema": "schema-1.json" }
}
```

---

## Full example

Extension TOML:

```toml
[extensions.build]
[[extensions.build.steps]]
type = "include_assets"
generate_manifest = true

[[extensions.build.steps.inclusions]]
type = "static"
source = "./assets"

[[extensions.build.steps.inclusions]]
type = "configKey"
key = "extensions[].targeting[].tools"
anchor = "extensions[].targeting[]"
group_by = "target"

[[extensions.build.steps.inclusions]]
type = "configKey"
key = "extensions[].targeting[].schema"
anchor = "extensions[].targeting[]"
group_by = "target"
```

Extension configuration:

```toml
[[extensions.targeting]]
target = "admin.intent.link"
tools  = "./tools.json"
schema = "./email-schema.json"

[[extensions.targeting]]
target = "admin.order.action"
tools  = "./tools.json"      # same file — gets renamed to tools-1.json
schema = "./order-schema.json"
```

Output bundle:

```
output/
  assets/          ← from static entry
  tools.json
  tools-1.json
  email-schema.json
  order-schema.json
  manifest.json
```

`manifest.json`:

```json
{
  "admin.intent.link": {
    "tools": "tools.json",
    "schema": "email-schema.json"
  },
  "admin.order.action": {
    "tools": "tools-1.json",
    "schema": "order-schema.json"
  }
}
```
