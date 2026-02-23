# Audit: Blockers to Removing Old Config Module Specs

## Blocker 1: `CONFIG_EXTENSION_IDS` and spec identifier imports

**Files:** `extension-instance.ts:41-49`, `app-management-client.ts:83-85,603,1352`

`CONFIG_EXTENSION_IDS` is a hardcoded array of the 9 config module identifiers. It's used to:
- Determine if an extension `isAppConfigExtension` (line 127-128)
- Classify registrations as configuration vs extension in the app management client (line 603)
- Set `experience` field in the app management client (line 1352)

**Fix:** Move identifier strings to `allAppModules` (they're already there as `module.identifier`). Replace `CONFIG_EXTENSION_IDS` with `allAppModules.map(m => m.identifier)`. Straightforward.

**Also imports identifiers directly:** `app-management-client.ts` imports `BrandingSpecIdentifier`, `AppAccessSpecIdentifier`, `AppHomeSpecIdentifier` for constructing create-app payloads (lines 1220-1234). These are just string constants — move them to the AppModule files or a shared constants file.

## Blocker 2: `contributeToAppConfigurationSchema`

**File:** `app.ts:178`, `specification.ts:212-218`

Each config spec contributes its Zod schema to the app-level schema via `contributeToAppConfigurationSchema`. This merged schema is used by `getAppVersionedSchema()` to validate the full TOML during initial loading. Removing the old specs would remove these schema contributions, meaning the app-level Zod validation would no longer validate module-specific fields.

**Fix:** Either:
- a) Have AppModules contribute to the app-level schema (add a `contributeSchema` method)
- b) Build the app-level schema from AppModule `tomlKeys` + basic type info
- c) Accept that app-level Zod validation only covers base fields, and rely on post-encode contract validation for module-specific fields

Option (c) is simplest and aligns with the direction: contracts are the source of truth, not Zod schemas.

## Blocker 3: `load-specifications.ts` spec registry

**File:** `load-specifications.ts:31-64`

The 9 config module specs are loaded here alongside non-config specs. `SORTED_CONFIGURATION_SPEC_IDENTIFIERS` defines their order. The loaded specs are used by:
- `getAppVersionedSchema()` — schema contribution
- `fetch-extension-specifications.ts` — merging with remote specs
- The loader — finding specs by identifier (`findSpecificationForType`)

**Fix:** Our `createConfigExtensionInstancesFromAppModules` already bypasses the spec registry for extraction. But it still calls `this.findSpecificationForType(appModule.identifier)` which looks up the old spec. We need the spec for creating `ExtensionInstance` (the constructor requires a `specification` parameter). The AppModule doesn't fully replace the spec — it replaces extraction and transform, but `ExtensionInstance` still needs the spec reference for things like `graphQLType`, `externalIdentifier`, `buildConfig`, etc.

**This is the biggest blocker.** We can't remove the old specs until either:
- `ExtensionInstance` no longer requires a `specification` reference
- OR: the spec is stripped down to just the metadata (identifier, graphQLType, etc.) without the schema/transform

## Blocker 4: `draftableExtensions` special-cases `AppAccessSpecIdentifier`

**File:** `app.ts:439-442`

```typescript
get draftableExtensions() {
  return this.realExtensions.filter(
    (ext) => ext.isUUIDStrategyExtension || ext.specification.identifier === AppAccessSpecIdentifier,
  )
}
```

App access is special-cased as draftable even though it's not UUID strategy. This is a business logic dependency on the identifier.

**Fix:** Move this to a property on AppModule (e.g., `isDraftable: true`).

## Blocker 5: `write-app-configuration-file.ts` uses old transform infrastructure

**File:** `write-app-configuration-file.ts:2,94-106`

Imports `reduceWebhooks` from the old transform helpers and `removeTrailingSlash` from old validation. Uses them to condense webhook subscriptions and strip `application_url` from URIs when writing the TOML file.

**Fix:** This is the TOML write-back flow (writing server config to a TOML file). It's related to `app config link` but is a different code path — it writes the full app config, not individual module configs. The `condenseComplianceAndNonComplianceWebhooks` function could move to the webhooks AppModule or to a shared utility.

## Blocker 6: Test files import old specs directly

**Files:** `app-toml.test.ts`, `app.test-data.ts`, `app_config_*.test.ts`, `deploy.test.ts`, `app-event-watcher.test.ts`, `app-management-client.test.ts`

Our own `app-toml.test.ts` imports old specs to compare encode output against `transformLocalToRemote`. Other test files use old spec identifiers and specs for test fixtures.

**Fix:** For our test: once the old specs are removed, remove the comparison tests (they verify parity between old and new — no longer needed). For other tests: update imports to use AppModule identifiers.

## Blocker 7: `patchWithAppDevURLs` and `getDevSessionUpdateMessages` on old specs

**Files:** `app_config_app_home.ts`, `app_config_app_access.ts`, `app_config_app_proxy.ts`

These are dev-mode behaviors defined on the old specs, called via `ExtensionInstance.patchWithAppDevURLs()` which delegates to `this.specification.patchWithAppDevURLs?.(this.configuration, urls)`.

**Fix:** Move these to AppModule or a separate dev-mode interface. They operate on `this.configuration` (now clean module-specific data) and should still work.

---

## Non-Config Extension Migration to AppModule

All extensions will become AppModule subclasses. Three non-config modules have already been prototyped (checkout_post_purchase, function, ui_extension). The risks (file I/O, UUID generation, etc.) are handled by async `encode()` and class subclassing.

### Risk 1: `deployConfig()` for non-config extensions reads files from disk

Functions read input queries, UI extensions generate build manifests, flow templates load workflow files. These ADD data, not just reshape it.

**Resolution:** The `encode()` method is async, which naturally accommodates file I/O. Each AppModule subclass implements `encode()` to do exactly what its old `spec.deployConfig()` did — including reading files from disk, generating computed fields, and loading localization.

### Risk 2: Non-config extensions use `uuid` UID strategy

UUID extensions store their IDs in TOML (or formerly `.env`). Each has its own TOML file. They don't share the app TOML.

**Resolution:** AppModule subclasses with `uidStrategy: 'uuid'` use `extract()` to return the full TOML content (no key picking needed). The extraction model works for both shared TOML (config modules) and individual TOML files (non-config extensions).

### Risk 3: `createContractBasedModuleSpecification` for server-driven modules

Modules like `data` and `channel_config` have no local code — they're created dynamically from server-provided contracts. They use `zod.any()` as schema and contract `strip` mode for extraction.

**Resolution:** These get thin AppModule instances with passthrough `encode()`. `channel_config` is already planned as a dedicated AppModule subclass (ChannelConfigModule).

### Risk 4: Extension TOML files (`.extension.toml`) vs app TOML (`shopify.app.toml`)

Non-config extensions live in separate `.extension.toml` files, each with their own schema. Config modules live in the shared `shopify.app.toml`.

**Resolution:** The AppModule class supports both patterns. Config modules use `tomlKeys` and `extractByKeys` to partition the shared TOML. Non-config modules use `uidStrategy: 'uuid'` and receive the full extension TOML.

### Risk 5: Non-config extensions have diverse `deployConfig()` patterns

Non-config extensions do things beyond simple field mapping:
- **Read files from disk** — functions (input.graphql), flow templates (.flow files), flow actions (schema files)
- **Generate computed fields** — functions (module_id via random UUID), UI extensions (build_manifest)
- **Load localization** — most extensions call `loadLocalesConfig()` during deploy (async I/O)
- **Route by type** — payments extensions dispatch to 6 different handlers based on target

**Resolution:** Async `encode()` handles all of these. Class subclassing allows each module to implement arbitrarily complex logic. The three prototyped modules (checkout_post_purchase, function, ui_extension) prove the pattern works across the complexity spectrum.

**Feasibility by extension type:**

| Extension | AppModule status | Notes |
|-----------|-----------------|-------|
| web_pixel, tax_calculation, checkout_post_purchase | Ready (trivial encode) | checkout_post_purchase already prototyped |
| checkout_ui, pos_ui, product_subscription | Ready (async encode for localization/deps) | Straightforward |
| payments | Ready (dispatch in encode) | Reuses existing 6-variant deploy config functions |
| flow_action, flow_trigger, flow_template | Ready (file I/O in encode) | Reuses existing schema/workflow loaders |
| function | Ready (prototyped) | File I/O + UUID generation handled by async encode |
| ui_extension | Ready (prototyped) | Most complex — 7 optional capability methods |
| theme | Ready (static encode) | Complexity is in preDeployValidation, not encode |

---

## Blocker 8: `write-app-configuration-file.ts` deeper coupling

**File:** `write-app-configuration-file.ts`

Beyond importing `reduceWebhooks`, this file uses `rewriteConfiguration()` which walks the Zod schema tree to determine field ordering when writing TOML. It uses the old Zod schemas (via `getAppVersionedSchema()`) to sort fields in the output TOML file. Removing the old schemas would break TOML file formatting.

**Fix:** Either:
- a) Use a fixed field ordering based on `tomlKeys` from AppModules
- b) Keep the Zod schemas for formatting purposes only (separate from validation/extraction)
- c) Accept arbitrary field ordering in output TOML

---

## Summary: Path to Removing Old Specs

| Blocker | Effort | Prerequisite |
|---------|--------|-------------|
| 1. CONFIG_EXTENSION_IDS | Small | None |
| 2. contributeToAppConfigurationSchema | Medium | Decision: rely on contracts for module validation |
| 3. ExtensionInstance needs spec reference | **Large** | Refactor ExtensionInstance to not require full spec, or create minimal spec stubs |
| 4. draftableExtensions special case | Small | None |
| 5. write-app-configuration-file | Small | Move reduceWebhooks to shared utility |
| 6. Test imports | Small | Done after other blockers |
| 7. Dev-mode behaviors | Medium | Move to AppModule or separate interface |

**Critical path:** Blocker 3 (ExtensionInstance requires spec) is the gate. Until ExtensionInstance can be created without a full `ExtensionSpecification` (with its schema, transform functions, etc.), the old spec files must exist. The spec could be reduced to a minimal metadata object, but that's a significant refactor of `ExtensionInstance` and everything that reads `extensionInstance.specification`.
