# Phase 3 Implementation Plan: Replace ExtensionInstance with ModuleInstance, Replace AppLoader with Loading Functions

## Overview

Phase 3 replaces the two remaining god classes: `ExtensionInstance` (68 public properties/methods, 600+ lines, 63 files referencing it) and `AppLoader` (900+ lines, class with mixed concerns). By the end of Phase 3, the codebase uses `ModuleInstance` (a lightweight data carrier that delegates to its `AppModule`) and plain loading functions instead of a monolithic loader class. The `App` class holds `ModuleInstance[]` instead of `ExtensionInstance[]`.

This is the structural refactor phase. By the time Phase 3 runs, every module type already has a real `AppModule` subclass (completed in Phase 2). The replacement is simpler: `ModuleInstance` delegates to real AppModules, not bridges. All 9 config modules and all non-config extension types are already on AppModule.

---

## 1. Scope

### What changes in Phase 3

- Introduce the `ModuleInstance` class per the end state proposal.
- Introduce `RemoteModuleMetadata` interface (extracted from `ExtensionSpecification` metadata fields).
- Introduce `TomlFile`, `AppTomlFile`, `ExtensionTomlFile` classes.
- Introduce `ProjectLayout` interface and `readProjectLayout()` function.
- Replace `AppLoader` class with `loadApp()` and helper functions.
- Replace all references to `ExtensionInstance` across 63 files with `ModuleInstance`.
- Replace the `App` class's `realExtensions: ExtensionInstance[]` with `instances: ModuleInstance[]`.
- Move `CONFIG_EXTENSION_IDS` logic to be derived from `ALL_MODULES.filter(m => m.tomlKeys !== undefined)`.
- Move `patchWithAppDevURLs` and `getDevSessionUpdateMessages` from specs to AppModule optional methods.
- Move `contributeToSharedTypeFile` to an optional AppModule method.

### What does NOT change in Phase 3

- `ExtensionSpecification` interface remains (deleted in Phase 4).
- The old spec files remain on disk (deleted in Phase 4).
- `getAppVersionedSchema()` and `contributeToAppConfigurationSchema()` remain (still used for TOML validation). Removed in Phase 4.

---

## 2. ExtensionInstance Property/Method Disposition

Every public property and method on `ExtensionInstance` is mapped to its destination.

### Properties

| Property | Current type | Destination | Notes |
|----------|-------------|-------------|-------|
| `entrySourceFilePath` | `string` | `ModuleInstance.entrySourceFilePath` | Keep as-is. Used by build, dev watch. |
| `devUUID` | `string` | `ModuleInstance.devUUID` | Keep. Computed from `uid` in constructor. |
| `localIdentifier` | `string` | `ModuleInstance.localIdentifier` | Alias for `handle`. Keep for backward compat. |
| `idEnvironmentVariableName` | `string` | `ModuleInstance.idEnvironmentVariableName` | Derived from `localIdentifier`. Keep. |
| `directory` | `string` | `ModuleInstance.directory` | Keep. |
| `configuration` | `TConfiguration` | `ModuleInstance.config` | Renamed to `config` per end state. Generic type becomes `unknown`. |
| `configurationPath` | `string` | `ModuleInstance.configPath` | Renamed per end state. |
| `outputPath` | `string` | `ModuleInstance.outputPath` | Keep. Mutable, set during build. |
| `handle` | `string` | `ModuleInstance.handle` | Keep. Computed by `module.computeHandle()`. |
| `specification` | `ExtensionSpecification` | Dropped from public API. `ModuleInstance` has `module: AppModule` and `remote?: RemoteModuleMetadata` instead. |
| `uid` | `string` | `ModuleInstance.uid` | Keep. Computed by `module.computeUid()`. |
| `cachedImportPaths` | `string[] (private)` | `ModuleInstance` private field | Keep for dev watch caching. |

### Computed properties (getters)

| Getter | Destination | Notes |
|--------|-------------|-------|
| `graphQLType` | `ModuleInstance.graphQLType` — delegates to `this.remote?.graphQLType ?? this.module.identifier` | |
| `type` | `ModuleInstance.type` — returns `this.module.identifier` | |
| `humanName` | `ModuleInstance.humanName` — delegates to `this.remote?.externalName ?? this.module.identifier` | |
| `name` | `ModuleInstance.name` — returns `this.config.name ?? this.humanName` | |
| `dependency` | Dropped. Only used by `generate` command to add npm deps. Can read from `remote?.dependency` or a static registry. |
| `externalType` | `ModuleInstance.externalType` — delegates to `this.remote?.externalIdentifier` | |
| `surface` | `ModuleInstance.surface` — delegates to `this.remote?.surface` | |
| `isPreviewable` | `ModuleInstance.isPreviewable` — delegates to `this.module.features?.includes('ui_preview')` | |
| `isThemeExtension` | `ModuleInstance.isThemeExtension` — delegates to `this.module.features?.includes('theme')` | |
| `isFunctionExtension` | `ModuleInstance.isFunctionExtension` — delegates to `this.module.features?.includes('function')` | |
| `isESBuildExtension` | `ModuleInstance.isESBuildExtension` — delegates to `this.module.features?.includes('esbuild')` | |
| `isSourceMapGeneratingExtension` | `ModuleInstance.isSourceMapGeneratingExtension` — delegates to features | |
| `isAppConfigExtension` | `ModuleInstance.isAppConfigExtension` — returns `this.module.tomlKeys !== undefined` (replaces UID strategy check) | |
| `isFlow` | `ModuleInstance.isFlow` — returns `this.module.identifier.includes('flow')` | |
| `isEditorExtensionCollection` | `ModuleInstance.isEditorExtensionCollection` — returns `this.module.identifier === 'editor_extension_collection'` | |
| `features` | `ModuleInstance.features` — delegates to `this.module.appModuleFeatures(this.config)` | AppModule gains `appModuleFeatures` method. |
| `outputFileName` | `ModuleInstance.outputFileName` — delegates to `this.module.outputFileName(this)` or computed from build mode | |
| `draftMessages` | `ModuleInstance.draftMessages` — same logic, uses `isAppConfigExtension` | |
| `isUUIDStrategyExtension` | `ModuleInstance.isUUIDStrategyExtension` — returns `this.module.uidStrategy === 'uuid'` | |
| `isSingleStrategyExtension` | `ModuleInstance.isSingleStrategyExtension` — returns `this.module.uidStrategy === 'single'` | |
| `isDynamicStrategyExtension` | `ModuleInstance.isDynamicStrategyExtension` — returns `this.module.uidStrategy === 'dynamic'` | |
| `outputPrefix` | `ModuleInstance.outputPrefix` — returns `this.handle` | |
| `singleTarget` | `ModuleInstance.singleTarget` — same logic on `this.config` | |
| `contextValue` | `ModuleInstance.contextValue` — same logic | |
| `buildCommand` | `ModuleInstance.buildCommand` — reads from function config | |
| `inputQueryPath` | `ModuleInstance.inputQueryPath` — `joinPath(this.directory, 'input.graphql')` | |
| `isJavaScript` | `ModuleInstance.isJavaScript` — checks `entrySourceFilePath` extension | |
| `devSessionCustomWatchPaths` | `ModuleInstance.devSessionCustomWatchPaths` — same logic | |

### Methods

| Method | Destination | Notes |
|--------|-------------|-------|
| `deployConfig()` | `ModuleInstance.encode()` — delegates to `this.module.encode(this.config, context)` + post-encode contract validation | Signature changes: returns Promise of encoded contract data. |
| `validate()` | `ModuleInstance.validate()` — delegates to `this.module.validate?.(this)` | AppModule gains optional `validate` method. |
| `preDeployValidation()` | `ModuleInstance.preDeployValidation()` — delegates to `this.module.preDeployValidation?.(this)` | AppModule gains optional `preDeployValidation` method. |
| `buildValidation()` | `ModuleInstance.buildValidation()` — delegates to `this.module.buildValidation?.(this)` | AppModule gains optional `buildValidation` method. |
| `keepBuiltSourcemapsLocally()` | `ModuleInstance.keepBuiltSourcemapsLocally()` — same logic | |
| `publishURL()` | `ModuleInstance.publishURL()` — uses `remote?.partnersWebIdentifier` | |
| `getOutputFolderId()` | `ModuleInstance.getOutputFolderId()` — same logic | |
| `getBundleExtensionStdinContent()` | `ModuleInstance.getBundleExtensionStdinContent()` — delegates to `this.module.getBundleExtensionStdinContent?.(this)` | AppModule gains optional method. |
| `shouldFetchCartUrl()` | `ModuleInstance.shouldFetchCartUrl()` — checks features | |
| `hasExtensionPointTarget()` | `ModuleInstance.hasExtensionPointTarget()` — delegates to `this.module.hasExtensionPointTarget?.(this.config, target)` | AppModule gains optional method. |
| `devSessionDefaultWatchPaths()` | `ModuleInstance.devSessionDefaultWatchPaths()` — delegates to `this.module.devSessionDefaultWatchPaths?.(this)` with fallback | AppModule gains optional method. |
| `watchConfigurationPaths()` | `ModuleInstance.watchConfigurationPaths()` — same logic | |
| `build()` | `ModuleInstance.build()` — delegates to `this.module.build?.(this, options)` | Already in end state proposal. |
| `buildForBundle()` | `ModuleInstance.buildForBundle()` — same logic, calls `this.build()` | |
| `copyIntoBundle()` | `ModuleInstance.copyIntoBundle()` — same logic | |
| `getOutputPathForDirectory()` | `ModuleInstance.getOutputPathForDirectory()` — same logic | |
| `bundleConfig()` | `ModuleInstance.toDeployPayload()` — renamed per end state. Calls `encode()` + wraps. | |
| `getDevSessionUpdateMessages()` | `ModuleInstance.getDevSessionUpdateMessages()` — delegates to `this.module.devMessages?.(this.config)` | |
| `patchWithAppDevURLs()` | `ModuleInstance.patchWithAppDevURLs()` — delegates to `this.module.patchForDev?.(this.config, urls)` | |
| `contributeToSharedTypeFile()` | `ModuleInstance.contributeToSharedTypeFile()` — delegates to `this.module.contributeToSharedTypeFile?.(this, map)` | |
| `watchedFiles()` | `ModuleInstance.watchedFiles()` — same logic using delegated methods | |
| `copyStaticAssets()` | `ModuleInstance.copyStaticAssets()` — delegates to `this.module.copyStaticAssets?.(this, outputPath)` | |
| `rescanImports()` | `ModuleInstance.rescanImports()` — same logic | |
| `isSentToMetrics()` | `ModuleInstance.isSentToMetrics()` — returns `!this.isAppConfigExtension` | |
| `isReturnedAsInfo()` | `ModuleInstance.isReturnedAsInfo()` — returns `!this.isAppConfigExtension` | |
| `buildHandle()` (private) | `AppModule.computeHandle()` — moved to the module | |
| `buildUIDFromStrategy()` (private) | `AppModule.computeUid()` — moved to the module | |
| `scanImports()` (private) | `ModuleInstance` private method — same logic | |

---

## 3. New Files to Create

All paths relative to `packages/app/src/cli/`.

### Core abstractions

| File | Purpose |
|------|---------|
| `models/app/module-instance.ts` | `ModuleInstance` class. Holds `module: AppModule`, `config`, `handle`, `uid`, `directory`, `configPath`, `remote?: RemoteModuleMetadata`. Delegates all behavior to its module. Contains all the methods listed in Section 2. |
| `models/app/remote-module-metadata.ts` | `RemoteModuleMetadata` interface. Fields: `contractSchema?`, `registrationLimit`, `graphQLType`, `externalIdentifier`, `externalName`, `partnersWebIdentifier`, `surface`, `dependency?`, `additionalIdentifiers`. Extracted from `ExtensionSpecification` metadata fields. |
| `models/app/toml-file.ts` | `TomlFile`, `AppTomlFile`, `ExtensionTomlFile` classes per end state. |
| `models/app/project-layout.ts` | `ProjectLayout` interface and `readProjectLayout()` function. |
| `models/app/loading.ts` | `loadApp()` function and helpers (`discoverExtensionFiles`, `loadExtensionToml`, `attachRemoteMetadata`). Replaces `AppLoader` class. |

### Updated registry

| File | Purpose |
|------|---------|
| `models/app/app-modules/index.ts` | Updated to export `ALL_MODULES` containing all config and non-config AppModule subclasses (all implemented in Phases 1 and 2). |

### Tests

| File | Purpose |
|------|---------|
| `models/app/module-instance.test.ts` | Tests for ModuleInstance: construction, delegation to module, encode, build, watch paths, etc. |
| `models/app/toml-file.test.ts` | Tests for TomlFile hierarchy. |
| `models/app/project-layout.test.ts` | Tests for readProjectLayout. |
| `models/app/loading.test.ts` | Tests for loadApp and helpers. Parity with existing loader.test.ts. |

---

## 4. Files to Modify (63 files)

Every file that references `ExtensionInstance` must be updated. The changes fall into categories:

### Category A: Type-only changes (import ExtensionInstance -> import ModuleInstance)

These files use `ExtensionInstance` only as a type annotation. The fix is a search-and-replace of the import and type references. The runtime behavior is identical because `ModuleInstance` exposes the same public API.

| File | References |
|------|-----------|
| `models/app/identifiers.ts` | Type parameter |
| `models/extensions/specification.ts` | Type in `preDeployValidation`, `buildValidation`, `contributeToSharedTypeFile` signatures |
| `services/info.ts` | Parameter types |
| `services/generate-schema.ts` | Parameter type |
| `services/function/runner.ts` | Parameter type |
| `services/function/replay.ts` | Parameter type |
| `services/function/replay.test.ts` | Test fixture type |
| `services/function/info.ts` | Parameter type |
| `services/function/info.test.ts` | Test fixture type |
| `services/function/common.ts` | Parameter type |
| `services/function/common.test.ts` | Test fixture type |
| `services/function/build.ts` | Parameter type |
| `services/function/ui/components/Replay/hooks/useFunctionWatcher.ts` | Parameter type |
| `services/extensions/bundle.ts` | Parameter types in `bundleThemeExtension`, `copyFilesForExtension` |
| `services/extensions/bundle.test.ts` | Test fixtures |
| `services/dev/update-extension.ts` | Parameter type |
| `services/dev/processes/previewable-extension.ts` | Parameter type |
| `services/dev/processes/draftable-extension.ts` | Parameter type |
| `services/dev/processes/dev-session/dev-session-logger.ts` | Parameter type |
| `services/dev/processes/dev-session/dev-session-logger.test.ts` | Test fixture type |
| `services/dev/extension/server/utilities.ts` | Parameter type |
| `services/dev/extension/server/utilities.test.ts` | Test fixture type |
| `services/dev/extension/server/models.ts` | Type in interface |
| `services/dev/extension/server.ts` | Parameter type |
| `services/dev/extension/payload/store.ts` | Parameter type |
| `services/dev/extension/payload/store.test.ts` | Test fixture type |
| `services/dev/extension/payload.ts` | Parameter type |
| `services/dev/extension/localization.ts` | Parameter type |
| `services/dev/extension.ts` | Parameter type |
| `services/dev/app-events/app-watcher-esbuild.ts` | Parameter type |
| `services/dev/app-events/app-event-watcher.ts` | Parameter type, `ExtensionInstance[]` arrays |
| `services/dev/app-events/app-event-watcher.test.ts` | Test fixtures |
| `services/dev/app-events/app-event-watcher-handler.ts` | Parameter type |
| `services/dev/app-events/app-diffing.ts` | Parameter type |
| `services/deploy/theme-extension-config.ts` | Parameter type |
| `services/deploy/theme-extension-config.test.ts` | Test fixture type |
| `services/context/identifiers-extensions.ts` | Parameter type |
| `services/context/identifiers-extensions.test.ts` | Test fixture type |
| `services/context/id-matching.ts` | Parameter type |
| `services/context/id-matching.test.ts` | Test fixture type |
| `services/context/id-manual-matching.test.ts` | Test fixture type |
| `services/context/breakdown-extensions.test.ts` | Test fixture type |
| `services/context.ts` | Parameter type |
| `services/build/extension.ts` | Parameter types in build functions |
| `services/build/extension.test.ts` | Test fixture type |
| `services/app/add-uid-to-extension-toml.ts` | Parameter type |
| `services/app/add-uid-to-extension-toml.test.ts` | Test fixture type |
| `utilities/extensions/theme.ts` | Parameter type |
| `utilities/extensions/theme.test.ts` | Test fixture type |
| `utilities/developer-platform-client/app-management-client.test.ts` | Test fixture type |
| `services/generate.test.ts` | Test fixture type |
| `services/dev/extension/utilities.ts` | Parameter type |

### Category B: Structural changes (these files use ExtensionInstance deeply)

| File | What changes |
|------|-------------|
| `models/extensions/extension-instance.ts` | Replaced by `models/app/module-instance.ts`. The old file remains temporarily as a re-export alias during migration, then deleted in Phase 4. |
| `models/app/app.ts` | `App` class changes: `realExtensions: ExtensionInstance[]` becomes `instances: ModuleInstance[]`. `allExtensions`, `nonConfigExtensions`, `draftableExtensions` accessors updated. `manifest()` method uses `ModuleInstance` API. `setDevApplicationURLs` calls `instance.patchWithAppDevURLs()`. `preDeployValidation()` calls `instance.preDeployValidation()`. `extensionsForType()` filters on `instance.type`. `updateExtensionUUIDS` sets `instance.devUUID`. Constructor param `modules` becomes `instances`. |
| `models/app/app.test.ts` | Test fixtures updated to create `ModuleInstance` instead of `ExtensionInstance`. |
| `models/app/app.test-data.ts` | Test data factory updated: `testExtensionInstance()` helper renamed or wrapped to produce `ModuleInstance`. This is the main test fixture factory used across 50+ test files. |
| `models/app/loader.ts` | `AppLoader` class body extracted to `loading.ts` functions. The class file becomes a thin wrapper that calls `loadApp()` for backward compatibility during migration, then is deleted in Phase 4. |
| `models/app/loader.test.ts` | Tests updated to use the new loading functions. |

### Category C: Spec files that import ExtensionInstance for type annotations in callbacks

| File | What changes |
|------|-------------|
| `models/extensions/specifications/ui_extension.ts` | `ExtensionInstance` type in `contributeToSharedTypeFile` parameter. Change to `ModuleInstance`. |
| `models/extensions/specifications/theme.ts` | `ExtensionInstance` type in `preDeployValidation` parameter. Change to `ModuleInstance`. |
| `models/extensions/specifications/ui_extension.test.ts` | Test fixtures. |
| `models/extensions/specifications/payments_app_extension.test.ts` | Test fixtures. |
| `models/extensions/specifications/function.test.ts` | Test fixtures. |
| `models/extensions/specifications/editor_extension_collection.test.ts` | Test fixtures. |

---

## 5. AppModule Interface Extensions

The `AppModule` base class (from Phase 1, extended in Phase 2 with non-config modules) gains several optional capability methods to absorb behavior from `ExtensionSpecification`:

```typescript
class AppModule<TToml = unknown, TContract = unknown> {
  // --- Existing from Phase 1 ---
  readonly identifier: string
  readonly uidStrategy: 'single' | 'dynamic' | 'uuid'
  readonly tomlKeys?: string[]
  extract(content: Record<string, unknown>): TToml | TToml[] | undefined
  async encode(toml: TToml, context: EncodeContext): Promise<TContract>
  decode?(contract: TContract): TToml

  // --- New in Phase 3: Identity ---
  computeHandle(config: TToml): string
  computeUid(config: TToml): string

  // --- New in Phase 3: Feature detection ---
  appModuleFeatures(config?: TToml): ExtensionFeature[]

  // --- New in Phase 3: Build (optional capability) ---
  buildConfig: BuildConfig  // {mode: 'none'} by default
  async build?(instance: ModuleInstance, options: BuildOptions): Promise<void>

  // --- New in Phase 3: Validation (optional capabilities) ---
  validate?(instance: ModuleInstance): Promise<Result<unknown, string>>
  preDeployValidation?(instance: ModuleInstance): Promise<void>
  buildValidation?(instance: ModuleInstance): Promise<void>

  // --- New in Phase 3: Dev (optional capabilities) ---
  patchForDev?(config: TToml, urls: ApplicationURLs): void
  devMessages?(config: TToml): Promise<string[]>

  // --- New in Phase 3: UI-specific (optional capabilities) ---
  getBundleExtensionStdinContent?(instance: ModuleInstance): {main: string; assets?: Asset[]}
  hasExtensionPointTarget?(config: TToml, target: string): boolean
  devSessionDefaultWatchPaths?(instance: ModuleInstance): string[]
  contributeToSharedTypeFile?(instance: ModuleInstance, map: Map<string, Set<string>>): Promise<void>
  copyStaticAssets?(instance: ModuleInstance, outputPath: string): Promise<void>

  // --- New in Phase 3: Metadata ---
  readonly additionalIdentifiers?: string[]
  readonly graphQLType?: string
  readonly dependency?: string
  readonly partnersWebIdentifier?: string
}
```

---

## 6. Module Delegation (No Bridge Needed)

Because Phase 2 implements all non-config extension types as real AppModule subclasses, Phase 3 does not need a bridge layer. Every `ModuleInstance` delegates directly to a real `AppModule` subclass with proper `encode()`, `build()`, `validate()`, etc. implementations.

This simplifies the replacement significantly: `ModuleInstance` wraps a fully-functional `AppModule`, not a bridge that delegates back to old specs.

---

## 7. RemoteModuleMetadata

Extracted from `ExtensionSpecification`:

```typescript
interface RemoteModuleMetadata {
  contractSchema?: string  // JSON Schema string
  registrationLimit: number
  graphQLType: string
  externalIdentifier: string
  externalName: string
  partnersWebIdentifier: string
  surface: string
  additionalIdentifiers: string[]
  dependency?: string
}
```

This is populated from the remote spec API response (currently stored on the merged `ExtensionSpecification`). In Phase 3, after loading remote specs, we attach `RemoteModuleMetadata` to each `ModuleInstance.remote`.

---

## 8. Loading Functions (Replacing AppLoader)

### `loadApp()`

```typescript
async function loadApp(directory: string, options: LoadOptions): Promise<App> {
  // 1. Load TOML
  const rawToml = await TomlFile.load(joinPath(directory, 'shopify.app.toml'))

  // 2. Project layout
  const layout = readProjectLayout(rawToml.content)

  // 3. App TOML extraction (config modules)
  const appToml = new AppTomlFile(rawToml, appTomlModules)
  const configInstances = appToml.extractAll()

  // 4. Extension file discovery + extraction
  const extensionFiles = await discoverExtensionFiles(directory, layout.extensionDirectories)
  const extensionInstances = extensionFiles.flatMap(f => f.extractAll())

  // 5. Remote metadata attachment
  const remoteSpecs = await fetchRemoteSpecs(appToml.clientId)
  const allInstances = [...configInstances, ...extensionInstances]
  attachRemoteMetadata(allInstances, remoteSpecs)

  // 6. Validation, handle uniqueness, etc.
  validateHandleUniqueness(allInstances)

  return new App(appToml, allInstances, layout, ...)
}
```

The key design: `AppLoader`'s 900 lines of mixed concerns split into:
- `TomlFile.load()` / `AppTomlFile` / `ExtensionTomlFile` — file I/O + parsing
- `readProjectLayout()` — workspace structure extraction
- `discoverExtensionFiles()` — glob for `.extension.toml` files
- `attachRemoteMetadata()` — link remote specs to instances
- `validateHandleUniqueness()` — cross-instance validation

---

## 9. Migration Strategy

Phase 3 is done as a single coordinated change because `ExtensionInstance` and `ModuleInstance` are structurally incompatible (different class, different property names like `configuration` vs `config`, `configurationPath` vs `configPath`). A gradual migration would require maintaining two parallel type hierarchies.

### Step-by-step order

1. **Create new files** (ModuleInstance, RemoteModuleMetadata, TomlFile hierarchy, ProjectLayout, loading functions). Purely additive. No existing code changes.

2. **Add compatibility layer to ModuleInstance.** Add deprecated getters that map old names to new:
   ```typescript
   /** @deprecated Use config */
   get configuration() { return this.config }
   /** @deprecated Use configPath */
   get configurationPath() { return this.configPath }
   ```
   This lets callsites work with either naming convention during migration.

3. **Update `app.test-data.ts`** test fixture factory to produce `ModuleInstance`. This is the single most impactful change: ~50 test files use `testExtensionInstance()`. Add a parallel `testModuleInstance()` factory and alias the old name to it.

4. **Update `App` class** to use `ModuleInstance[]`. Add compatibility aliases:
   ```typescript
   get realExtensions() { return this.instances }  // deprecated alias
   ```

5. **Batch-update all 52 "Category A" files** (type-only changes). This is a mechanical find-and-replace:
   - `import {ExtensionInstance} from '...extension-instance.js'` -> `import {ModuleInstance} from '...module-instance.js'`
   - `ExtensionInstance` type references -> `ModuleInstance`

6. **Update the 6 "Category B" files** that have deeper structural dependencies.

7. **Update the 6 "Category C" spec files** that use `ExtensionInstance` in callback signatures.

8. **Run full test suite at each step.** The compatibility aliases ensure no test breaks during migration.

9. **Remove compatibility aliases** once all references are updated.

---

## 10. Testing Strategy

### 10.1 ModuleInstance unit tests

- Construction: verify `handle`, `uid`, `devUUID`, `localIdentifier`, `idEnvironmentVariableName` are computed correctly.
- Delegation: verify every method delegates to its `AppModule`.
- Compatibility: verify deprecated aliases (`configuration`, `configurationPath`) work.
- Encode: verify it calls `module.encode()` and does post-encode contract validation.
- Build: verify it delegates to `module.build()`.

### 10.2 Loading function tests

- Port all tests from `loader.test.ts` to `loading.test.ts`.
- Verify `loadApp()` produces the same set of instances (same identifiers, handles, UIDs) as the old `AppLoader`.
- Verify `discoverExtensionFiles()` finds the same TOML files.
- Verify `readProjectLayout()` extracts correct directories and build settings.
- Verify remote metadata attachment works.

### 10.3 Integration test strategy

- **All existing tests must pass with no behavioral changes.** The compatibility aliases and identical public API ensure this.
- Run the full CI pipeline after each migration step.
- Any test that constructs `ExtensionInstance` directly is updated to construct `ModuleInstance` directly.

### 10.4 Parity verification

For each module type:
- Create a `ModuleInstance` backed by its real `AppModule` subclass with the same configuration as an existing test case.
- Verify `encode()` produces identical output to `ExtensionInstance.deployConfig()`.
- Verify `build()` dispatches to the same build function.
- Verify `validate()` calls the same validation logic.

---

## 11. Risks and Mitigations

### 11.1 63-file change set is large

**Risk:** A 63-file change is hard to review and has a high probability of introducing regressions.

**Mitigation:**
- Most changes (52 of 63) are mechanical type-import replacements with no behavioral change.
- Compatibility aliases on `ModuleInstance` ensure the old property names still work, reducing the surface area of breaking changes.
- The migration can be done in 3-4 PRs: (1) new files only, (2) App class + test data, (3) batch type replacements, (4) remove compatibility aliases.

### 11.2 `configuration` vs `config` rename breaks callsites

**Risk:** Renaming `this.configuration` to `this.config` across 63 files risks typos and missed references.

**Mitigation:**
- The compatibility getter `get configuration() { return this.config }` ensures old callsites work during migration.
- TypeScript will catch any missed references at compile time.
- The rename can be deferred: keep `configuration` as the primary name on `ModuleInstance` and rename in a follow-up if desired.

### 11.3 Test data factory is a single point of failure

**Risk:** `app.test-data.ts`'s `testExtensionInstance()` is used by ~50 test files. Changing it risks cascading failures.

**Mitigation:**
- Add `testModuleInstance()` alongside the old factory, then alias `testExtensionInstance = testModuleInstance`.
- The new factory produces `ModuleInstance` backed by real `AppModule` subclasses, ensuring identical behavior.
- Run the full test suite after this single change before proceeding with other files.

### 11.4 `App` class backward compatibility

**Risk:** Code that accesses `app.realExtensions` expects `ExtensionInstance[]`. Changing to `ModuleInstance[]` could break external consumers.

**Mitigation:**
- `ModuleInstance` has the same public API as `ExtensionInstance` (with compatibility aliases). TypeScript structural typing means any code that reads `extension.handle`, `extension.type`, etc. will work with both types.
- Keep `realExtensions` as a deprecated alias for `instances` during migration.

### 11.5 Build dispatch complexity

**Risk:** `ExtensionInstance.build()` has a complex switch on `specification.buildConfig.mode`. Moving this to `ModuleInstance` could introduce inconsistencies.

**Mitigation:**
- `ModuleInstance.build()` delegates to `this.module.build(this, options)`. Each real AppModule subclass (implemented in Phase 2) has the correct build logic.
- Alternatively, the build dispatch can stay on `ModuleInstance` directly (it reads `this.module.buildConfig.mode` and dispatches) rather than moving to the module. This preserves the current behavior exactly.

---

## 12. Definition of Done

Phase 3 is complete when ALL of the following criteria are met:

### Functional criteria

1. **`ModuleInstance` class exists** with all properties and methods from Section 2.
2. **`RemoteModuleMetadata` interface exists** and is used by `ModuleInstance.remote`.
3. **`TomlFile`, `AppTomlFile`, `ExtensionTomlFile` classes exist** and are used by the loading functions.
4. **`ProjectLayout` interface and `readProjectLayout()` exist** and are used by the loading functions.
5. **`loadApp()` function exists** and replaces `AppLoader` as the primary loading path.
6. **`App.instances` (was `App.realExtensions`) holds `ModuleInstance[]`** everywhere.
7. **Zero references to `ExtensionInstance` in production code** outside of `extension-instance.ts` itself.
8. **`CONFIG_EXTENSION_IDS`** is replaced by a derived check (e.g., `module.tomlKeys !== undefined`).
9. **`patchWithAppDevURLs` and `getDevSessionUpdateMessages`** delegate through `AppModule` methods.

### Test criteria

10. **All existing tests pass** with no behavioral changes.
11. **`ModuleInstance` has dedicated unit tests.**
12. **Loading functions have tests** with parity to existing `loader.test.ts`.
13. **Integration tests verify** that `loadApp()` produces the same instance set as before.

### Non-functional criteria

14. **No new runtime dependencies introduced.**
15. **`ExtensionInstance` file still exists** (deletion is Phase 4).
16. **`ExtensionSpecification` interface still exists** (deletion is Phase 4).
17. **CI passes** including all existing integration tests.

### Not required for Phase 3

- Deletion of old spec files, `ExtensionInstance`, `ExtensionSpecification`, `AppLoader` (Phase 4).
- Format convergence (Phase 5).

---

## 13. Implementation Order

1. **Create `remote-module-metadata.ts`** — pure type definition.
2. **Extend `AppModule` interface** with optional capability methods (validate, build, dev, etc.).
3. **Create `module-instance.ts`** with full API including compatibility aliases. Unit test.
4. **Create `toml-file.ts`**, `project-layout.ts`**. Unit test.
5. **Create `loading.ts`** with `loadApp()` and helpers. Integration test.
6. **Update `app.test-data.ts`** — add `testModuleInstance()`, alias `testExtensionInstance` to it. Run full suite.
7. **Update `App` class in `app.ts`** — change to `ModuleInstance[]`, add compatibility aliases. Run full suite.
8. **Batch-update Category A files** (52 files, type-import replacement). Run full suite.
9. **Update Category B files** (6 files, deeper changes). Run full suite.
10. **Update Category C files** (6 spec files). Run full suite.
11. **Remove compatibility aliases.** Run full suite.
12. **Run full CI pipeline.**

Steps 1-5 are purely additive. Steps 6-7 are the high-risk structural changes. Steps 8-10 are mechanical. Step 11 is cleanup.

---

## 14. File Inventory Summary

### New files: 9

- 1 `ModuleInstance` class + test
- 1 `RemoteModuleMetadata` interface
- 1 `TomlFile` hierarchy + test
- 1 `ProjectLayout` + test
- 1 `loadApp` functions + test

### Modified files: 63

- 52 type-import replacements (Category A)
- 6 structural changes (Category B)
- 6 spec file signature updates (Category C)
- Minus 1 overlap (extension-instance.ts is both modified and effectively replaced)

### Deleted files: 0

Deletion is Phase 4.
