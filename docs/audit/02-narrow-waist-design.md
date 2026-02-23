# Target Architecture

## The Universal Primitive: `AppModule`

Every extension is an app module. Every app module has a contract. The CLI is a client that extracts config, encodes it to contract shape, validates, and sends. Modules that need richer behavior (file I/O, localization, build manifests) get it through async encode — not through a separate system.

```typescript
class AppModule<TToml, TContract> {
  identifier: string
  uidStrategy: 'single' | 'dynamic' | 'uuid'

  tomlKeys?: string[]                                     // for app-toml modules
  extract(content: Record<string, unknown>): TToml | undefined

  encode(toml: TToml, context: EncodeContext): Promise<TContract>  // async — supports file I/O
  decode?(contract: TContract): TToml                              // for app config link
}

interface EncodeContext {
  appConfiguration: AppConfigurationWithoutPath
  directory: string    // for reading files from disk
  apiKey: string
}
```

### Why async encode is the key

Making `encode` async unifies config modules and non-config extensions:

| Module type | What encode does | Sync? |
|------------|-----------------|-------|
| branding | Renames `handle` → `app_handle` | Yes (trivially async) |
| app_access | Flattens `access_scopes.*` → top level | Yes |
| function | Reads `input.graphql` from disk, generates `module_id` | **No — needs async** |
| ui_extension | Generates build manifest, reads localization | **No — needs async** |
| flow_template | Reads `.flow` file, base64 encodes | **No — needs async** |

Same interface. The difference is what happens inside encode, not which system the module uses.

### The three UID strategies map to extraction

| Strategy | Source | extract() behavior |
|----------|--------|-------------------|
| `single` | Shared `shopify.app.toml` | Picks keys from shared TOML via `tomlKeys` |
| `dynamic` | Shared `shopify.app.toml` | Returns array of items (e.g., one per webhook subscription) |
| `uuid` | Own `.extension.toml` | Entire TOML file is the source (no key picking) |

## Current State (validated, 553 tests passing)

### What's wired

- **9 config modules** implemented as AppModules with extract, async encode, decode
- **Loader** uses `createConfigExtensionInstancesFromAppModules()` for extraction
- **deployConfig()** uses `appModule.encode()` with full EncodeContext (directory, apiKey, appConfiguration)
- **Post-encode contract validation** with `fail` mode (no strip)
- **Category error fixed** in `unifiedConfigurationParserFactory`
- **select-app.ts** uses `appModule.decode()` for app config link
- **Clean extraction** via `extractByKeys` — no base field leaking

### What's not wired yet

- Non-config extensions (functions, UI, payments, flow, theme, etc.) still use old `ExtensionSpecification` path
- Old spec files still exist (needed by `ExtensionInstance` constructor)
- `patchWithAppDevURLs` / `getDevSessionUpdateMessages` still on old specs
- `mergeAllWebhooks` still in Zod schema
- `write-app-configuration-file.ts` still uses old transform helpers

## Migration Path

### Phase 1: Config modules (DONE)
All 9 config modules implemented. Extraction, encode, decode, and all callsites wired. 553 tests passing.

### Phase 2: All non-config AppModules
All non-config extension types become AppModule subclasses. Three modules (checkout_post_purchase, function, ui_extension) are already prototyped with parity tests passing. The remaining types are implemented in batches by complexity:
- **Trivial:** `checkout_post_purchase`, `theme`, `channel_config` — direct field mapping
- **Low:** `web_pixel`, `tax_calculation`, `checkout_ui_extension`, `editor_extension_collection` — field mapping + localization/deps
- **Medium:** `function`, `flow_action`, `flow_trigger`, `flow_template`, `pos_ui_extension`, `product_subscription` — file I/O, computed fields
- **High:** `payments_app_extension` — 6-variant dispatch
- **Very high:** `ui_extension` — encode + 7 optional capability methods

Each gets an AppModule with `uidStrategy: 'uuid'`, `extract` that returns the full TOML, and async `encode` that does what their current `spec.deployConfig()` does. The risks (file I/O, UUID generation, etc.) are handled by async `encode()` and class subclassing.

### Phase 3: Replace ExtensionInstance with ModuleInstance
Once all extensions are AppModules (Phase 2 complete), replace the runtime instance type:
- Introduce `ModuleInstance` class that delegates to its `AppModule`
- Replace all 63 files referencing `ExtensionInstance` with `ModuleInstance`
- Replace `AppLoader` with plain loading functions
- Move `CONFIG_EXTENSION_IDS` to be derived from `ALL_MODULES`

### Phase 4: Remove old infrastructure
Once all callsites use `ModuleInstance`:
- Delete `createConfigExtensionSpecification`, `createExtensionSpecification`
- Delete `TransformationConfig`, `CustomTransformationConfig`, `resolveAppConfigTransform`, `appConfigTransform`
- Delete `transformLocalToRemote`, `transformRemoteToLocal` from `ExtensionSpecification` interface
- Delete `ExtensionInstance`, `ExtensionSpecification`, `AppLoader`
- Delete old spec files, `contributeToAppConfigurationSchema`, `getAppVersionedSchema`

### Phase 5: Per-module format convergence
For each module, align TOML with contract format. Delete the encode/decode when they become identity functions. The contract validates TOML directly.
