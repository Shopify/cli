# Phase 1 Implementation Plan: App Module Architecture for Config Modules

## Overview

Phase 1 introduces the new `AppModule` class hierarchy alongside the existing `ExtensionSpecification` + `ExtensionInstance` system. It covers the 9 config modules that live in `shopify.app.toml`. At the end of Phase 1, these modules are loaded, encoded, decoded, and validated through the new system while the old specs continue to exist for backward compatibility. No old code is deleted yet.

---

## 1. Scope

### What changes in Phase 1

- Introduce the `AppModule` base class (replacing the prototype's interface with a class per the end state proposal).
- Introduce `EncodeContext` interface.
- Implement 9 concrete `AppModule` subclasses for the config modules: `BrandingModule`, `AppAccessModule`, `WebhooksModule`, `WebhookSubscriptionModule`, `EventsModule`, `PrivacyComplianceWebhooksModule`, `AppProxyModule`, `PointOfSaleModule`, `AppHomeModule`.
- Create a flat module registry (`allAppModules`) as class instances.
- Wire `AppModule.encode()` into `ExtensionInstance.deployConfig()` so that config modules use the new encode path instead of `transformLocalToRemote` / `deployConfig` on the spec.
- Wire `AppModule.decode()` into `remoteAppConfigurationExtensionContent()` in `select-app.ts` so that app config link uses the new decode path instead of `transformRemoteToLocal` on the spec.
- Wire `AppModule.extract()` into `AppLoader.createConfigExtensionInstancesFromAppModules()` so that config module instance creation uses explicit key extraction instead of the base-schema-leaking Zod parsing approach.
- Fix the contract validation category error in `json-schema.ts`: skip pre-transform contract validation for modules that have a `transformLocalToRemote`, moving contract validation post-encode instead.
- Move post-encode contract validation into the `deployConfig()` method on `ExtensionInstance`, gated behind the AppModule path.

### What does NOT change in Phase 1

- `ExtensionSpecification` interface and all spec files remain untouched (they are still loaded and used for non-config extensions, and their schemas still contribute to `getAppVersionedSchema()`).
- `ExtensionInstance` class remains the runtime instance type everywhere. We do NOT introduce `ModuleInstance` yet.
- `AppLoader` class structure remains. We add a new method but do not restructure it.
- `TomlFile` / `AppTomlFile` / `ExtensionTomlFile` / `ProjectLayout` abstractions from the end state are NOT introduced yet. Those are Phase 3+.
- The `AppToml` orchestrator class from the prototype is NOT shipped. It was useful for testing but the real integration goes through `AppLoader` and `ExtensionInstance`.
- No non-config extension types are migrated (functions, UI extensions, themes, etc.).
- No existing spec files are deleted.
- `getAppVersionedSchema()` and `contributeToAppConfigurationSchema()` remain in use (schema merging still happens for now).
- `CONFIG_EXTENSION_IDS` remains (still referenced in some places).

---

## 2. New Files to Create

All paths relative to `packages/app/src/cli/`.

### Core abstractions

| File | Purpose |
|------|---------|
| `models/app/app-module.ts` | `AppModule` base **class** with generic `TToml`/`TContract` type parameters. Provides default passthrough `encode()`, `decode()`, `extract()` via `extractByKeys()`. Also exports the `EncodeContext` interface, the `extractByKeys()` helper function, and the `AnyAppModule` type alias. |

### Module implementations (one file per module)

| File | Purpose |
|------|---------|
| `models/app/app-modules/branding.ts` | `BrandingModule extends AppModule`. Overrides `encode`, `decode`. `tomlKeys = ['name', 'handle']`, `uidStrategy = 'single'`. |
| `models/app/app-modules/app-access.ts` | `AppAccessModule extends AppModule`. Field renames (access_scopes -> scopes, auth.redirect_urls -> redirect_url_allowlist, etc.). |
| `models/app/app-modules/webhooks.ts` | `WebhooksModule extends AppModule`. Extracts `api_version` from the shared `webhooks` key. |
| `models/app/app-modules/webhook-subscription.ts` | `WebhookSubscriptionModule extends AppModule`. `uidStrategy = 'dynamic'`. Overrides `extract()` to split subscriptions into individual items, excluding compliance topics. Overrides `encode()` to resolve relative URIs. |
| `models/app/app-modules/events.ts` | `EventsModule extends AppModule`. Forward passthrough, decode strips `identifier` field from subscriptions. |
| `models/app/app-modules/privacy-compliance-webhooks.ts` | `PrivacyComplianceWebhooksModule extends AppModule`. Reads from shared `webhooks` key, extracts compliance URIs, resolves relative URIs. |
| `models/app/app-modules/app-proxy.ts` | `AppProxyModule extends AppModule`. Resolves relative proxy URLs via `prependApplicationUrl`. |
| `models/app/app-modules/point-of-sale.ts` | `PointOfSaleModule extends AppModule`. Unwraps `pos.embedded` for encode, rewraps for decode. |
| `models/app/app-modules/app-home.ts` | `AppHomeModule extends AppModule`. Renames `application_url` -> `app_url`, `app_preferences.url` -> `preferences_url`. |
| `models/app/app-modules/index.ts` | Registry. Exports all 9 module instances and `allAppModules: AppModule[]` array. |

### Tests

| File | Purpose |
|------|---------|
| `models/app/app-module.test.ts` | Tests for the base class: `extractByKeys`, default passthrough `encode`/`decode`, default `extract` behavior. |
| `models/app/app-modules/branding.test.ts` | Parity tests: `encode` matches `transformLocalToRemote`, `decode` matches `transformRemoteToLocal`, `extract` returns correct keys. |
| `models/app/app-modules/app-access.test.ts` | Same pattern. |
| `models/app/app-modules/webhooks.test.ts` | Same pattern. |
| `models/app/app-modules/webhook-subscription.test.ts` | Same pattern, plus tests for subscription splitting and compliance topic exclusion. |
| `models/app/app-modules/events.test.ts` | Same pattern, plus decode strips `identifier`. |
| `models/app/app-modules/privacy-compliance-webhooks.test.ts` | Same pattern, plus compliance URI extraction from both `compliance_topics` and legacy `privacy_compliance`. |
| `models/app/app-modules/app-proxy.test.ts` | Same pattern, plus relative URL resolution. |
| `models/app/app-modules/point-of-sale.test.ts` | Same pattern. |
| `models/app/app-modules/app-home.test.ts` | Same pattern. |

---

## 3. Files to Modify

### `models/extensions/extension-instance.ts`

**What changes:** The `deployConfig()` method gains a primary path that looks up the `AppModule` for the current spec identifier. If found, it calls `appModule.encode()` and performs post-encode contract validation. If not found, it falls back to the existing `spec.deployConfig()` / `spec.transformLocalToRemote()` path.

**Why:** This is the central integration point for deploy. The AppModule encode path replaces the scattered transform mechanisms for config modules.

**Specific changes:**
- Add import of `allAppModules` from `../app/app-modules/index.js`.
- Add import of `jsonSchemaValidate`, `normaliseJsonSchema` from `@shopify/cli-kit/node/json-schema`.
- In `deployConfig()`, before the existing spec-based logic, add: look up `allAppModules.find(m => m.identifier === this.specification.identifier)`. If found, call `appModule.encode(this.configuration, context)`. If the spec has a `validationSchema.jsonSchema`, run post-encode contract validation with `fail` mode (not `strip`). Return the encoded result. Only fall through to the old path if no AppModule is found.

### `models/app/loader.ts`

**What changes:** Replace the two separate methods `createConfigExtensionInstances()` and `createWebhookSubscriptionInstances()` with a single `createConfigExtensionInstancesFromAppModules()` method that iterates `allAppModules`.

**Why:** Unified extraction eliminates base field leaking (Problem 3) and the hardcoded webhook subscription splitting.

**Specific changes:**
- Add imports: `allAppModules` from `./app-modules/index.js`, `AppModule`, `DynamicAppModule`, `AnyAppModule` from `./app-module.js`.
- Add `createConfigExtensionInstancesFromAppModules()` private method that:
  1. Iterates single-UID modules first, then dynamic-UID modules (preserving ordering).
  2. For each module, calls `appModule.extract(configAsRecord)` to get the data slice.
  3. If data is present, creates an `ExtensionInstance` via `this.createExtensionInstance()`.
  4. For dynamic modules, creates one instance per extracted item.
  5. Also handles specs without AppModules (contract-only specs) using the existing `parseConfigurationObjectAgainstSpecification` + `validateConfigurationExtensionInstance` path.
  6. Detects unsupported TOML sections by tracking which keys are claimed.
- In `loadExtensions()`, call `createConfigExtensionInstancesFromAppModules()` instead of the old methods.

### `services/app/select-app.ts`

**What changes:** In `remoteAppConfigurationExtensionContent()`, add a primary decode path that checks for an `AppModule` matching the module identifier. If found, calls `appModule.decode(config)` and merges the result. Falls back to the existing `spec.transformRemoteToLocal()` path if no AppModule is found.

**Why:** This ensures `app config link` uses the same module definitions for decode as deploy uses for encode -- co-located, consistent transforms.

**Specific changes:**
- Add import of `allAppModules` from `../../models/app/app-modules/index.js`.
- In the `configRegistrations.forEach` loop, before the existing spec-based transform, check `allAppModules.find(m => m.identifier === moduleIdentifier)`. If found and has `decode`, use `appModule.decode(config)`.

### `utilities/json-schema.ts`

**What changes:** In `unifiedConfigurationParserFactory()`, add an early return for specs that have a `transformLocalToRemote` function. If a spec transforms TOML to a different contract shape, validating pre-transform TOML against the post-transform contract is a category error. Skip the JSON Schema validation and return just the Zod parser.

**Why:** This fixes the silent data loss bug (Problem 1 / the access_scopes incident) for ALL config modules with transforms, not just the 9 with AppModules. Contract validation for these modules now happens post-encode in `deployConfig()` instead.

**Specific changes:**
- After the early return for empty contract schemas, add a check: if `merged.transformLocalToRemote !== undefined`, return `merged.parseConfigurationObject` directly. Add a comment explaining this is the category error fix.

---

## 4. Files to Delete

**None in Phase 1.** The old system continues to exist alongside the new one. Deletion happens in Phase 4.

The following files will become dead code (their transforms are shadowed by AppModule encode/decode) but are NOT deleted:
- `models/extensions/specifications/app_config_branding.ts` (still loaded by spec system)
- `models/extensions/specifications/app_config_app_access.ts`
- `models/extensions/specifications/app_config_app_home.ts`
- `models/extensions/specifications/app_config_app_proxy.ts`
- `models/extensions/specifications/app_config_point_of_sale.ts`
- `models/extensions/specifications/app_config_webhook.ts`
- `models/extensions/specifications/app_config_webhook_subscription.ts`
- `models/extensions/specifications/app_config_events.ts`
- `models/extensions/specifications/app_config_privacy_compliance_webhooks.ts`

Their Zod schemas are still used by `getAppVersionedSchema()` for TOML validation during loading. Their transform functions are shadowed but not removed.

---

## 5. Key Differences from Prototype

The prototype validated the approach using interfaces (plain objects satisfying `AppModule<TToml, TContract>`). The end state uses classes. **Note:** AppModule is already a class in the current prototype — the interface-to-class conversion described below is already done. The following documents what changed:

### 5.1 Interface to class

**Prototype:**
```typescript
export interface AppModule<TToml = object, TContract = object> {
  identifier: string
  tomlKeys?: string[]
  extract(content: Record<string, unknown>): TToml | undefined
  encode(toml: TToml, context: EncodeContext): Promise<TContract>
  decode?(contract: TContract): TToml
  uidStrategy: 'single' | 'dynamic' | 'uuid'
}
```

**Phase 1:**
```typescript
export class AppModule<TToml = unknown, TContract = unknown> {
  readonly identifier: string
  readonly uidStrategy: 'single' | 'dynamic' | 'uuid'
  readonly tomlKeys: string[]

  constructor(options: { identifier: string; uidStrategy: ...; tomlKeys: string[] })

  extract(content: Record<string, unknown>): TToml | TToml[] | undefined {
    return extractByKeys(this.tomlKeys, content) as TToml | undefined
  }

  async encode(toml: TToml, context: EncodeContext): Promise<TContract> {
    return toml as unknown as TContract  // default passthrough
  }

  decode(contract: TContract): TToml {
    return contract as unknown as TToml  // default passthrough
  }
}
```

**Key differences:**
1. `encode` and `decode` have default passthrough implementations instead of being mandatory/optional interface methods.
2. `extract` has a default implementation using `extractByKeys` so subclasses only override when they need custom logic.
3. `tomlKeys` is required (no `?`). For config modules it is always present. The `uuid` strategy modules (Phase 2) will use an empty array or different mechanism.
4. Constructor takes an options object for the required properties.

### 5.2 No separate `DynamicAppModule` interface

**Prototype:** Had `DynamicAppModule` with a different `extract` return type (`TToml[]`).

**Phase 1:** The base class `extract()` returns `TToml | TToml[] | undefined`. `WebhookSubscriptionModule` overrides `extract()` to return `TToml[] | undefined`. The loader checks `uidStrategy === 'dynamic'` and treats the return value as an array. This matches the end state proposal where `extract` on the base class returns `TToml | TToml[] | undefined`.

### 5.3 No `AppToml` orchestrator class

**Prototype:** Had `AppToml` class with `toDeployPayloads()`, `fromServerModules()`, `getKeyOwnership()`.

**Phase 1:** These responsibilities stay where they are:
- `toDeployPayloads()` -> `ExtensionInstance.deployConfig()` calls `appModule.encode()`.
- `fromServerModules()` -> `remoteAppConfigurationExtensionContent()` in `select-app.ts` calls `appModule.decode()`.
- `getKeyOwnership()` -> `createConfigExtensionInstancesFromAppModules()` tracks `usedKeys` for unsupported section detection.

The `AppToml` class was a prototype exploration tool. The real orchestration in Phase 1 goes through the existing `AppLoader` and `ExtensionInstance` classes, which are modified to delegate to AppModules.

### 5.4 Module instances vs module objects

**Prototype:** `brandingModule` was a plain object literal satisfying the interface.

**Phase 1:** `brandingModule` is an instance of `BrandingModule` class:
```typescript
class BrandingModule extends AppModule<BrandingToml, BrandingContract> {
  constructor() {
    super({ identifier: 'branding', uidStrategy: 'single', tomlKeys: ['name', 'handle'] })
  }
  // ...overrides...
}
export const brandingModule = new BrandingModule()
```

### 5.5 `decode` is not optional

**Prototype:** `decode?` was optional on the interface.

**Phase 1:** `decode` is always present on the base class (default passthrough). Subclasses override it. This means every module always has a decode path, which simplifies the callsites (no `?.decode` checks needed).

---

## 6. Testing Strategy

### 6.1 New unit tests for each module (9 test files)

Each module test file follows the same pattern proven in the prototype's `app-toml.test.ts`:

**a) Extract tests:**
- Given a full TOML config, `module.extract()` returns only the keys this module owns.
- Given a TOML config missing this module's keys, `module.extract()` returns `undefined`.
- For dynamic modules (webhook_subscription): extract splits correctly, excludes compliance topics.
- For shared-key modules (webhooks, webhook_subscription, privacy_compliance_webhooks): each extracts correctly from the same `webhooks` section.

**b) Encode parity tests:**
- `module.encode(toml, context)` produces the same output as the existing `spec.transformLocalToRemote(toml, appConfiguration)`.
- Test with the same inputs used in the existing spec test files to ensure exact behavioral parity.
- Test edge cases: empty/missing optional fields, relative URLs with and without application_url.

**c) Decode parity tests:**
- `module.decode(contract)` produces the same output as the existing `spec.transformRemoteToLocal(contract)`.
- Test with the same inputs used in the existing spec test files.

**d) Round-trip tests:**
- For each module: `decode(encode(extract(fullConfig)))` produces data that, when re-extracted, matches the original extraction. This validates the forward/reverse transforms are consistent.

### 6.2 Base class tests

- Test `extractByKeys` with various key combinations.
- Test default passthrough: `new AppModule({...}).encode(data, ctx)` returns data unchanged.
- Test default passthrough: `new AppModule({...}).decode(data)` returns data unchanged.
- Test default extract: uses `extractByKeys` with `this.tomlKeys`.

### 6.3 Integration tests (modified existing tests)

**`models/extensions/extension-instance.test.ts`:**
- Existing tests for `deployConfig()` should continue to pass unchanged (they test non-config extensions that still use the old path).
- Add new tests verifying that config extension instances go through the AppModule encode path:
  - Create an ExtensionInstance with a branding spec, call `deployConfig()`, verify output matches AppModule.encode().
  - Verify post-encode contract validation runs and logs debug output on contract errors.
  - Verify fallback: an extension without an AppModule still uses the old spec path.

**`models/app/loader.test.ts`:**
- Existing tests for `loadApp` should continue to pass (the loaded extensions should have the same handles, UIDs, configs).
- Add tests for `createConfigExtensionInstancesFromAppModules`:
  - Full TOML with all 9 module types produces correct set of ExtensionInstances.
  - TOML with missing sections produces only the relevant instances (no phantom instances).
  - Webhook subscriptions are split into individual instances.
  - Unsupported TOML sections are detected and reported.

**`services/app/select-app.test.ts`:**
- Existing tests for `remoteAppConfigurationExtensionContent` should continue to pass.
- Add tests verifying that the AppModule decode path is used for the 9 config modules.

**`utilities/json-schema.test.ts`:**
- Add test verifying that specs with `transformLocalToRemote` skip JSON Schema validation (return just the Zod parser).
- Existing tests for specs without transforms should still pass.

### 6.4 Verification strategy

1. **Run existing test suite with no changes to test files.** All existing tests must pass before any modifications. This establishes the baseline.
2. **Add the new files (AppModule class, 9 modules, registry).** Run new module unit tests. These are additive and do not affect existing tests.
3. **Modify `extension-instance.ts` (deployConfig).** Run the full test suite. Existing deploy tests must still pass because the AppModule encode path produces identical output to the old transform path.
4. **Modify `loader.ts` (createConfigExtensionInstancesFromAppModules).** Run the full test suite. The loaded app structure must be identical.
5. **Modify `select-app.ts` (decode path).** Run the full test suite.
6. **Modify `json-schema.ts` (category error fix).** Run the full test suite. This change should only affect config modules with transforms, and for those, it removes a validation that was producing incorrect results.
7. **Run the full CI pipeline** to verify no regressions in integration tests.

---

## 7. Risks and Mitigations

### 7.1 Behavioral divergence between old and new encode/decode

**Risk:** The new `AppModule.encode()` produces slightly different output from `spec.transformLocalToRemote()` for some edge case, causing deploy to send wrong data.

**Mitigation:**
- The prototype's parity tests (Criterion 3 and 4 in `app-toml.test.ts`) proved identical output for representative inputs. Port these tests and expand them.
- In the `deployConfig()` integration, during development, temporarily add an assertion that both paths produce the same result (dual-write verification). Remove before merging.
- Keep the old spec transforms in place. If a bug is found in the new path, the AppModule lookup can be temporarily disabled to fall back to the old path.

### 7.2 Extract changes cause different instance creation

**Risk:** The new `extractByKeys`-based extraction creates different ExtensionInstance sets than the old `parseConfigurationObjectAgainstSpecification` approach (e.g., missing instances, or extra instances).

**Mitigation:**
- The prototype proved that `extractByKeys` produces correct data slices for all 9 modules.
- Key difference: the old approach created phantom instances when base schema fields (like `name`) leaked across modules. The new approach eliminates these phantoms. If any code depends on phantom instances existing, it will break.
- To catch this: add logging in `createConfigExtensionInstancesFromAppModules` that compares the set of created instance identifiers with what the old path would have created. Log any differences during development.
- The `validateConfigurationExtensionInstance` check in the old path filtered out phantom instances by checking if `deployConfig()` returned content. The new path avoids creating them at all, which is strictly better.

### 7.3 Post-encode contract validation produces new errors

**Risk:** Moving contract validation from pre-encode (strip mode, incorrect) to post-encode (fail mode, correct) surfaces validation errors that were previously hidden.

**Mitigation:**
- Post-encode validation in Phase 1 logs errors via `outputDebug` (debug level) rather than blocking deploy. This is intentionally non-breaking.
- The errors logged are genuinely useful -- they indicate real contract violations that were being silently stripped. But they should not block deploy until Phase 3+ when we have confidence in the validation.
- The `json-schema.ts` category error fix (skipping pre-encode validation for modules with transforms) actually reduces the number of validation runs, not increases them. It prevents the silent data loss bug.

### 7.4 Module priority/ordering changes

**Risk:** The order in which config extension instances are created affects handle uniqueness validation or deploy ordering.

**Mitigation:**
- `allAppModules` is ordered to match `SORTED_CONFIGURATION_SPEC_IDENTIFIERS` from `load-specifications.ts`.
- Single-UID modules are processed before dynamic-UID modules, matching the old behavior where `createConfigExtensionInstances` ran before `createWebhookSubscriptionInstances`.
- Add a test that verifies the ordering of the registry matches expectations.

### 7.5 Shared TOML key conflicts

**Risk:** Multiple modules claiming the same TOML key (`webhooks` is shared by 3 modules) could cause double-processing or data conflicts.

**Mitigation:**
- This is handled by design: each module's `extract()` reads the full `webhooks` section but extracts different data from it. `WebhooksModule` extracts only `api_version`. `WebhookSubscriptionModule` extracts non-compliance subscriptions. `PrivacyComplianceWebhooksModule` extracts compliance subscriptions.
- The prototype proved this works correctly with the shared key pattern.
- The `usedKeys` tracking in the loader counts `webhooks` as used when any of the three modules processes it.

### 7.6 Import cycles

**Risk:** The new module files import types from `app.ts` (for `CurrentAppConfiguration`) and from spec-related files (for webhook types). This could create circular import chains.

**Mitigation:**
- The prototype already imports from these files without issues.
- Module files only import types and pure utility functions (no side effects at module level).
- ESM circular imports are safe as long as module-level code does not reference the circular dependency (only function bodies do).

---

## 8. Definition of Done

Phase 1 is complete when ALL of the following criteria are met:

### Functional criteria

1. **All 9 config modules exist as `AppModule` subclasses** with `extract`, `encode`, and `decode` methods.
2. **The module registry** (`allAppModules`) contains all 9 modules and is exported.
3. **`ExtensionInstance.deployConfig()`** uses `AppModule.encode()` for all 9 config modules instead of `spec.transformLocalToRemote()` / `spec.deployConfig()`.
4. **`remoteAppConfigurationExtensionContent()`** uses `AppModule.decode()` for all 9 config modules instead of `spec.transformRemoteToLocal()`.
5. **`AppLoader`** uses `AppModule.extract()` to create config extension instances instead of parsing the full app config against each spec's Zod schema.
6. **No phantom instances** are created (instances where only base schema fields like `name` leaked in).
7. **Webhook subscription splitting** is handled by `WebhookSubscriptionModule.extract()` instead of the hardcoded `createWebhookSubscriptionInstances()`.
8. **Post-encode contract validation** runs for all 9 config modules (debug-level logging, non-blocking).
9. **Pre-encode contract validation** is skipped for specs with `transformLocalToRemote` (the category error fix in `json-schema.ts`).

### Test criteria

10. **All existing tests pass** with no modifications to existing test assertions. (Test files may gain new imports or new test cases, but no existing test is changed or removed.)
11. **Each of the 9 modules has a dedicated test file** with extract, encode-parity, decode-parity, and round-trip tests.
12. **The base `AppModule` class has unit tests** for default behavior.
13. **Integration tests** verify that `loadApp()` produces the same set of ExtensionInstances (same identifiers, handles, UIDs) as before.
14. **Integration tests** verify that `deployConfig()` produces the same output for config extensions as before.
15. **Integration tests** verify that `remoteAppConfigurationExtensionContent()` produces the same output as before.

### Non-functional criteria

16. **No new runtime dependencies** are introduced.
17. **No existing files are deleted.**
18. **No changes to the public API** of any package.
19. **The old spec-based system continues to work** for all non-config extensions (functions, UI extensions, themes, etc.).
20. **CI passes** including all existing integration tests.

### Not required for Phase 1

- Non-config extension types as AppModule subclasses (Phase 2).
- `ModuleInstance` class (Phase 3).
- `TomlFile` / `AppTomlFile` / `ExtensionTomlFile` classes (Phase 3).
- `ProjectLayout` separation (Phase 3).
- Deletion of old spec files, `CONFIG_EXTENSION_IDS`, `getAppVersionedSchema()`, etc. (Phase 4).

---

## 9. Implementation Order

The work should be done in this order to minimize risk at each step:

1. **Create `app-module.ts`** with the base class, `EncodeContext`, `extractByKeys`.
2. **Create the 9 module files** and their tests. Verify parity with existing transforms.
3. **Create `app-modules/index.ts`** registry.
4. **Modify `json-schema.ts`** (category error fix). This is a standalone safety fix that can land independently.
5. **Modify `extension-instance.ts`** (`deployConfig` AppModule path). Run full suite.
6. **Modify `select-app.ts`** (decode AppModule path). Run full suite.
7. **Modify `loader.ts`** (`createConfigExtensionInstancesFromAppModules`). Run full suite.
8. **Add integration tests** for the modified callsites.

Steps 1-3 are purely additive (new files, no existing code changes). Steps 4-7 modify existing files. This ordering lets us validate the new modules in isolation before wiring them in.

---

## 10. File Inventory Summary

### New files: 21

- 1 base class file
- 9 module files
- 1 registry file
- 10 test files (1 base + 9 modules)

### Modified files: 4

- `models/extensions/extension-instance.ts`
- `models/app/loader.ts`
- `services/app/select-app.ts`
- `utilities/json-schema.ts`

### Deleted files: 0
