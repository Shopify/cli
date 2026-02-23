# Phase 3: Detailed Step-by-Step Implementation Guide

## Overview

Phase 3 replaces `ExtensionInstance` with `ModuleInstance` and `AppLoader` with plain loading functions across the entire CLI. This is the highest-risk phase: it touches 65 files, rewrites the test data factory used by 50+ test files, and changes the core `App` class's data model. The guide is structured to minimize risk: every step is additive before it is destructive, every structural change is followed by a full test run, and compatibility aliases bridge old and new naming conventions during the transition.

**Prerequisite reading:**
- `docs/audit/phase-3-plan.md` (the high-level plan with property disposition table)
- `docs/audit/05-end-state-proposal.md` (target architecture)
- `packages/app/src/cli/models/extensions/extension-instance.ts` (the class being replaced)
- `packages/app/src/cli/models/app/app.ts` lines 318-640 (the App class)
- `packages/app/src/cli/models/app/app.test-data.ts` (the test factory)

All file paths are relative to `packages/app/src/cli/` unless stated otherwise.

---

## Section 1: Prerequisites

Before starting Phase 3, confirm the following are true:

### 1.0 CI check for Phase 2 completeness

Before starting Phase 3, add a CI check that fails if any `ExtensionSpecification` identifier in `loadLocalExtensionsSpecifications()` lacks a corresponding `AppModule` in `allAppModules`. This makes the Phase 2 completeness requirement enforceable and prevents the escape hatch (see Sub-step 6.5a) from being triggered unexpectedly. The check should be a test in the app-modules directory:

```typescript
// packages/app/src/cli/models/app/app-modules/completeness.test.ts
import {allAppModules} from './index.js'
import {loadLocalExtensionsSpecifications} from '../../extensions/load-specifications.js'

describe('Phase 2 completeness', () => {
  test('every ExtensionSpecification identifier has a corresponding AppModule', async () => {
    const specs = await loadLocalExtensionsSpecifications()
    const moduleIdentifiers = new Set(allAppModules.map(m => m.identifier))
    const missingModules = specs
      .filter(spec => !moduleIdentifiers.has(spec.identifier))
      .map(spec => spec.identifier)
    expect(missingModules).toEqual([])
  })
})
```

### 1.1 All modules from Phases 1-2 are implemented and registered

The file `models/app/app-modules/index.ts` must export `allAppModules` containing **every** module type -- all 9 config modules and all non-config extension types. At the start of Phase 3, the registry looks like:

```typescript
// Config modules (from Phase 1)
brandingModule, appAccessModule, webhooksModule, webhookSubscriptionModule,
eventsModule, privacyComplianceWebhooksModule, appProxyModule, pointOfSaleModule, appHomeModule,

// Non-config extensions (from Phase 2)
checkoutPostPurchaseModule, functionModule, uiExtensionModule,
themeModule, paymentsModule, flowActionModule, flowTriggerModule,
flowTemplateModule, checkoutUIModule, webPixelModule,
taxCalculationModule, posUIModule, productSubscriptionModule,
editorExtensionCollectionModule, marketingActivityModule,
// ... all remaining types
```

**Verify:** Every spec identifier in `loadLocalExtensionsSpecifications()` has a corresponding AppModule in `allAppModules`. Run:
```bash
npx vitest run packages/app/src/cli/models/app/app-modules/non-config-parity.test.ts
```

### 1.2 All deployConfig() paths go through AppModule.encode()

In `extension-instance.ts`, the `deployConfig()` method currently has two paths:
- **Path 1:** Finds the AppModule by identifier and calls `appModule.encode()` (the universal path)
- **Path 2:** Falls back to `spec.deployConfig()` / `spec.transformLocalToRemote()` for modules not yet on AppModule

By the time Phase 3 starts, Path 2 should never execute. Every module has an AppModule, so Path 1 always matches. Confirm by adding a temporary assertion or log in Path 2, running the full test suite, and verifying it is never reached.

### 1.4 Branching strategy

See `docs/audit/branching-strategy.md` for the full branching and review strategy.

Phase 3 uses a **Graphite stack of 5 sequential PRs**:
1. PR 1: New files (ModuleInstance, TomlFile, ProjectLayout, loading functions)
2. PR 2: Test data factory update (highest risk)
3. PR 3: App class + loader migration
4. PR 4: Batch type-import replacements (55+ files)
5. PR 5: Remove compatibility aliases

Use `gt create` for each PR in sequence, then `gt submit` to push the full stack. After each PR merges, `gt restack` to rebase the remaining stack.

### 1.5 Understanding ModuleInstance vs ExtensionInstance

| Aspect | ExtensionInstance | ModuleInstance |
|--------|-------------------|---------------|
| Type definition | Via `this.specification: ExtensionSpecification` (30+ fields) | Via `this.module: AppModule` (focused, capability-based) |
| Config property | `this.configuration` (generic `TConfiguration`) | `this.config` (generic `TToml`, but `configuration` compatibility alias provided) |
| Config path | `this.configurationPath` | `this.configPath` (but `configurationPath` compatibility alias provided) |
| Feature detection | `this.specification.appModuleFeatures(config)` | `this.module.appModuleFeatures(config)` |
| Is config extension? | UID strategy check: `['single','dynamic'].includes(spec.uidStrategy)` | `this.module.tomlKeys !== undefined` |
| Remote metadata | Scattered across `specification.*` fields | `this.module.remote: RemoteModuleMetadata` |
| Deploy config | `this.deployConfig()` with mixed paths | `this.encode()` delegates to `this.module.encode()` |
| Bundle config | `this.bundleConfig()` | `this.toDeployPayload()` |

---

## Section 2: Create ModuleInstance class

### File to create

**`packages/app/src/cli/models/app/module-instance.ts`**

### Constructor

```typescript
import {AppModule, EncodeContext} from './app-module.js'
import {RemoteModuleMetadata} from './remote-module-metadata.js'
import {ExtensionFeature, Asset} from '../extensions/specification.js'
import {Identifiers} from './identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationWithoutPath} from './app.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ok} from '@shopify/cli-kit/node/result'
import {constantize, slugify} from '@shopify/cli-kit/common/string'
import {hashString, nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath, basename, normalizePath, resolvePath} from '@shopify/cli-kit/node/path'
import {fileExists, touchFile, moveFile, writeFile, glob, copyFile, globSync} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {extractJSImports, extractImportPathsRecursively} from '@shopify/cli-kit/node/import-extractor'
import {uniq} from '@shopify/cli-kit/common/array'
import {jsonSchemaValidate, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'

export class ModuleInstance {
  // --- Core identity ---
  readonly module: AppModule
  config: unknown
  handle: string
  uid: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configPath: string
  entrySourceFilePath: string
  outputPath: string

  // --- Private ---
  private cachedImportPaths?: string[]
  // Holds the original spec's parseConfigurationObject for the specification shim.
  // Attached during construction from the spec used for Zod validation in the loader.
  private _specParseConfigurationObject?: (obj: object) => {state: 'ok' | 'error'; data?: unknown; errors?: unknown[]}

  constructor(options: {
    module: AppModule
    config: unknown
    directory: string
    configPath: string
    entryPath?: string
  }) {
    this.module = options.module
    this.config = options.config
    this.directory = options.directory
    this.configPath = options.configPath
    this.entrySourceFilePath = options.entryPath ?? ''
    this.handle = this.module.computeHandle(this.config)
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.uid = this.module.computeUid(this.config)
    this.devUUID = `dev-${this.uid}`
    this.outputPath = this.directory

    // Set outputPath based on build mode
    if (this.features.includes('esbuild') || this.type === 'tax_calculation') {
      this.outputPath = joinPath(this.directory, 'dist', this.outputFileName)
    }
    if (this.isFunctionExtension) {
      const cfg = this.config as unknown as FunctionConfigType
      const defaultPath = joinPath('dist', 'index.wasm')
      this.outputPath = joinPath(this.directory, cfg.build?.path ?? defaultPath)
    }
  }
```

### Every property and getter

The following getters map 1:1 from ExtensionInstance. Every getter that previously read from `this.specification` now reads from `this.module` or `this.module.remote`.

```typescript
  // --- Compatibility aliases (kept during migration, removed in step 8) ---

  /** @deprecated Use config */
  get configuration(): unknown { return this.config }
  set configuration(value: unknown) { this.config = value }

  /** @deprecated Use configPath */
  get configurationPath(): string { return this.configPath }
  set configurationPath(value: string) { this.configPath = value }

  /** @deprecated Specification is replaced by module + remote metadata */
  get specification(): {
    identifier: string
    uidStrategy: string
    buildConfig: {mode: string; filePatterns?: string[]; ignoredFilePatterns?: string[]}
    [key: string]: unknown
  } {
    // Shim that lets old callsites read specification.identifier, specification.uidStrategy,
    // specification.buildConfig without changes. This is the ONLY compatibility shim that
    // fabricates a fake object -- all other aliases are trivial renames.
    return {
      identifier: this.module.identifier,
      uidStrategy: this.module.uidStrategy,
      buildConfig: this.module.buildConfig ?? {mode: 'none'},
      graphQLType: this.module.remote?.graphQLType,
      externalIdentifier: this.module.remote?.externalIdentifier,
      externalName: this.module.remote?.externalName ?? this.module.identifier,
      partnersWebIdentifier: this.module.remote?.partnersWebIdentifier ?? this.module.identifier,
      surface: this.module.remote?.surface ?? '',
      registrationLimit: this.module.remote?.registrationLimit ?? 1,
      dependency: this.module.remote?.dependency,
      additionalIdentifiers: this.module.remote?.additionalIdentifiers ?? [],
      appModuleFeatures: (cfg?: unknown) => this.module.appModuleFeatures(cfg ?? this.config),
      getBundleExtensionStdinContent: this.module.getBundleExtensionStdinContent
        ? (cfg: unknown) => this.module.getBundleExtensionStdinContent!(this)
        : undefined,
      hasExtensionPointTarget: this.module.hasExtensionPointTarget
        ? (cfg: unknown, target: string) => this.module.hasExtensionPointTarget!(cfg, target)
        : undefined,
      getDevSessionUpdateMessages: this.module.devMessages
        ? (cfg: unknown) => this.module.devMessages!(cfg)
        : undefined,
      patchWithAppDevURLs: this.module.patchForDev
        ? (cfg: unknown, urls: ApplicationURLs) => this.module.patchForDev!(cfg, urls)
        : undefined,
      preDeployValidation: this.module.preDeployValidation
        ? (ext: ModuleInstance) => this.module.preDeployValidation!(ext)
        : undefined,
      buildValidation: this.module.buildValidation
        ? (ext: ModuleInstance) => this.module.buildValidation!(ext)
        : undefined,
      contributeToSharedTypeFile: this.module.contributeToSharedTypeFile
        ? (ext: ModuleInstance, map: Map<string, Set<string>>) =>
            this.module.contributeToSharedTypeFile!(ext, map)
        : undefined,
      copyStaticAssets: this.module.copyStaticAssets
        ? (cfg: unknown, dir: string, out: string) =>
            this.module.copyStaticAssets!(this, out)
        : undefined,
      validate: this.module.validate
        ? (cfg: unknown, cfgPath: string, dir: string) => this.module.validate!(this)
        : undefined,

      // --- Properties discovered via codebase-wide `.specification.` audit ---
      // These are accessed externally or via type-cast access patterns.

      // Used by deployConfig() Path 2 fallback (extension-instance.ts:255)
      // During Phase 3, ModuleInstance.encode() replaces this, so it's only needed
      // for the compatibility shim. Returns undefined (Path 2 is dead code by Phase 3).
      deployConfig: undefined,
      transformLocalToRemote: undefined,

      // Used by post-encode contract validation (extension-instance.ts:231)
      // The shim provides it from remote metadata.
      validationSchema: this.module.remote?.contractSchema
        ? {jsonSchema: this.module.remote.contractSchema}
        : undefined,

      // CRITICAL: Used by services/dev/update-extension.ts:147 when the whole
      // specification object is passed to parseConfigurationObjectAgainstSpecification().
      // Without this, dev mode hot-reload crashes with TypeError.
      parseConfigurationObject: (obj: object) => {
        // Delegate to Zod schema parsing. The module doesn't have a parseConfigurationObject
        // method directly, but the old spec's version just ran Zod validation.
        // During Phase 3, update-extension.ts should be migrated to not use
        // parseConfigurationObjectAgainstSpecification. Until then, this shim
        // calls the Zod parse from the original spec (attached during loading).
        return this._specParseConfigurationObject?.(obj) ?? {state: 'ok' as const, data: obj}
      },
    }
  }

  // --- Type identity getters ---

  get type(): string {
    return this.module.identifier
  }

  get graphQLType(): string {
    return (this.module.remote?.graphQLType ?? this.module.identifier).toUpperCase()
  }

  get humanName(): string {
    return this.module.remote?.externalName ?? this.module.identifier
  }

  get name(): string {
    return (this.config as {name?: string}).name ?? this.humanName
  }

  get dependency(): string | undefined {
    return this.module.remote?.dependency
  }

  get externalType(): string {
    return this.module.remote?.externalIdentifier ?? this.module.identifier
  }

  get surface(): string {
    return this.module.remote?.surface ?? ''
  }

  // --- Feature detection getters ---

  get features(): ExtensionFeature[] {
    return this.module.appModuleFeatures(this.config)
  }

  get isPreviewable(): boolean {
    return this.features.includes('ui_preview')
  }

  get isThemeExtension(): boolean {
    return this.features.includes('theme')
  }

  get isFunctionExtension(): boolean {
    return this.features.includes('function')
  }

  get isESBuildExtension(): boolean {
    return this.features.includes('esbuild')
  }

  get isSourceMapGeneratingExtension(): boolean {
    return this.features.includes('generates_source_maps')
  }

  get isAppConfigExtension(): boolean {
    return this.module.tomlKeys !== undefined
  }

  get isFlow(): boolean {
    return this.module.identifier.includes('flow')
  }

  get isEditorExtensionCollection(): boolean {
    return this.module.identifier === 'editor_extension_collection'
  }

  // --- UID strategy getters ---

  get isUUIDStrategyExtension(): boolean {
    return this.module.uidStrategy === 'uuid'
  }

  get isSingleStrategyExtension(): boolean {
    return this.module.uidStrategy === 'single'
  }

  get isDynamicStrategyExtension(): boolean {
    return this.module.uidStrategy === 'dynamic'
  }

  // --- Build/output getters ---

  get outputFileName(): string {
    const mode = (this.module.buildConfig ?? {mode: 'none'}).mode
    if (mode === 'copy_files' || mode === 'theme') return ''
    if (mode === 'function') return 'index.wasm'
    return `${this.handle}.js`
  }

  get outputPrefix(): string {
    return this.handle
  }

  get buildCommand(): string | undefined {
    const cfg = this.config as unknown as FunctionConfigType
    return cfg.build?.command
  }

  get inputQueryPath(): string {
    return joinPath(this.directory, 'input.graphql')
  }

  get isJavaScript(): boolean {
    return Boolean(
      this.entrySourceFilePath.endsWith('.js') || this.entrySourceFilePath.endsWith('.ts'),
    )
  }

  // --- Config-derived getters ---

  get singleTarget(): string | undefined {
    const targets = (getPathValue(this.config, 'targeting') as {target: string}[]) ?? []
    if (targets.length !== 1) return undefined
    return targets[0]?.target
  }

  get contextValue(): string {
    let context = this.singleTarget ?? ''
    if (this.isFlow) context = (this.config as {handle?: string}).handle ?? ''
    return context
  }

  get draftMessages() {
    if (this.isAppConfigExtension) return {successMessage: undefined, errorMessage: undefined}
    const successMessage = `Draft updated successfully for extension: ${this.localIdentifier}`
    const errorMessage = `Error updating extension draft for ${this.localIdentifier}`
    return {successMessage, errorMessage}
  }

  get devSessionCustomWatchPaths(): string[] | undefined {
    const cfg = this.config as unknown as FunctionConfigType
    if (!cfg.build || !cfg.build.watch) return undefined
    const watchPaths = [cfg.build.watch].flat().map((path) => joinPath(this.directory, path))
    watchPaths.push(joinPath(this.directory, 'locales', '**.json'))
    watchPaths.push(joinPath(this.directory, '**', '!(.)*.graphql'))
    watchPaths.push(joinPath(this.directory, '**.toml'))
    return watchPaths
  }
```

### Every method

Each method maps from ExtensionInstance. Methods that previously called `this.specification.*` now call `this.module.*`.

```typescript
  // --- Deploy / encode ---

  async encode({
    apiKey,
    appConfiguration,
  }: {
    apiKey: string
    appConfiguration: AppConfigurationWithoutPath
  }): Promise<{[key: string]: unknown} | undefined> {
    const encoded = (await this.module.encode(this.config, {
      appConfiguration,
      directory: this.directory,
      apiKey,
    })) as {[key: string]: unknown}
    if (!encoded || Object.keys(encoded).length === 0) return undefined

    // Post-encode contract validation
    if (this.module.remote?.contractSchema) {
      const contract = await normaliseJsonSchema(this.module.remote.contractSchema)
      const validation = jsonSchemaValidate(encoded, contract, 'fail', this.module.identifier)
      if (validation.state === 'error') {
        outputDebug(
          `Contract validation errors for "${this.handle}" (${this.module.identifier}): ${JSON.stringify(validation.errors)}`,
        )
      }
    }
    return encoded
  }

  /**
   * @deprecated Use encode(). Kept for migration compatibility.
   */
  async deployConfig(options: {
    apiKey: string
    appConfiguration: AppConfigurationWithoutPath
  }): Promise<{[key: string]: unknown} | undefined> {
    return this.encode(options)
  }

  // --- Validation ---

  validate() {
    if (!this.module.validate) return Promise.resolve(ok(undefined))
    return this.module.validate(this)
  }

  preDeployValidation(): Promise<void> {
    if (!this.module.preDeployValidation) return Promise.resolve()
    return this.module.preDeployValidation(this)
  }

  buildValidation(): Promise<void> {
    if (!this.module.buildValidation) return Promise.resolve()
    return this.module.buildValidation(this)
  }

  // --- Build ---

  async build(options: ExtensionBuildOptions): Promise<void> {
    if (this.module.build) {
      return this.module.build(this, options)
    }

    // Fallback: dispatch based on buildConfig.mode (same logic as ExtensionInstance)
    const mode = (this.module.buildConfig ?? {mode: 'none'}).mode
    switch (mode) {
      case 'theme':
        await buildThemeExtension(this, options)
        return bundleThemeExtension(this, options)
      case 'function':
        return buildFunctionExtension(this, options)
      case 'ui':
        await buildUIExtension(this, options)
        return this.copyStaticAssets()
      case 'tax_calculation':
        await touchFile(this.outputPath)
        await writeFile(this.outputPath, '(()=>{})();')
        break
      case 'copy_files': {
        const bc = this.module.buildConfig as {mode: 'copy_files'; filePatterns: string[]; ignoredFilePatterns?: string[]}
        return copyFilesForExtension(this, options, bc.filePatterns, bc.ignoredFilePatterns)
      }
      case 'none':
        break
    }
  }

  async buildForBundle(options: ExtensionBuildOptions, bundleDirectory: string, outputId?: string) {
    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, outputId)
    await this.build(options)
    const bundleInputPath = joinPath(bundleDirectory, this.getOutputFolderId(outputId))
    await this.keepBuiltSourcemapsLocally(bundleInputPath)
  }

  async copyIntoBundle(options: ExtensionBuildOptions, bundleDirectory: string, extensionUuid?: string) {
    const defaultOutputPath = this.outputPath
    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, extensionUuid)
    const buildMode = (this.module.buildConfig ?? {mode: 'none'}).mode

    if (this.isThemeExtension) {
      await bundleThemeExtension(this, options)
    } else if (buildMode !== 'none') {
      outputDebug(`Will copy pre-built file from ${defaultOutputPath} to ${this.outputPath}`)
      if (await fileExists(defaultOutputPath)) {
        await copyFile(defaultOutputPath, this.outputPath)
        if (buildMode === 'function') {
          await bundleFunctionExtension(this.outputPath, this.outputPath)
        }
      }
    }
  }

  getOutputPathForDirectory(directory: string, outputId?: string): string {
    const id = this.getOutputFolderId(outputId)
    const outputFile = this.outputFileName === '' ? '' : joinPath('dist', this.outputFileName)
    return joinPath(directory, id, outputFile)
  }

  getOutputFolderId(outputId?: string): string {
    return outputId ?? this.uid
  }

  // --- Source maps ---

  async keepBuiltSourcemapsLocally(inputPath: string): Promise<void> {
    if (!this.isSourceMapGeneratingExtension) return
    const pathsToMove = await glob(`**/${this.handle}.js.map`, {
      cwd: inputPath, absolute: true, followSymbolicLinks: false,
    })
    const pathToMove = pathsToMove[0]
    if (!pathToMove) return
    const outputPath = joinPath(this.directory, 'dist', basename(pathToMove))
    await moveFile(pathToMove, outputPath, {overwrite: true})
    outputDebug(`Source map for ${this.localIdentifier} created: ${outputPath}`)
  }

  // --- URL / publish ---

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}): Promise<string> {
    const fqdn = await partnersFqdn()
    const parnersPath = this.module.remote?.partnersWebIdentifier ?? this.module.identifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  // --- UI extension methods ---

  getBundleExtensionStdinContent(): {main: string; assets?: Asset[]} {
    if (this.module.getBundleExtensionStdinContent) {
      return this.module.getBundleExtensionStdinContent(this)
    }
    const relativeImportPath = this.entrySourceFilePath.replace(this.directory, '')
    return {main: `import '.${relativeImportPath}';`}
  }

  shouldFetchCartUrl(): boolean {
    return this.features.includes('cart_url')
  }

  hasExtensionPointTarget(target: string): boolean {
    return this.module.hasExtensionPointTarget?.(this.config, target) ?? false
  }

  // --- Dev ---

  devSessionDefaultWatchPaths(): string[] {
    if (this.module.devSessionDefaultWatchPaths) {
      return this.module.devSessionDefaultWatchPaths(this)
    }
    // Default: UI extension special case, then entry file
    if (this.module.identifier === 'ui_extension') {
      const {main, assets} = this.getBundleExtensionStdinContent()
      const mainPaths = extractJSImports(main, this.directory)
      const assetPaths = assets?.flatMap((asset) => extractJSImports(asset.content, this.directory)) ?? []
      return mainPaths.concat(...assetPaths)
    }
    return [this.entrySourceFilePath]
  }

  async watchConfigurationPaths(): Promise<string[]> {
    if (this.isAppConfigExtension) {
      return [this.configPath]
    }
    const additionalPaths = []
    if (await fileExists(joinPath(this.directory, 'locales'))) {
      additionalPaths.push(joinPath(this.directory, 'locales', '**.json'))
    }
    additionalPaths.push(joinPath(this.directory, '**.toml'))
    return additionalPaths
  }

  async getDevSessionUpdateMessages(): Promise<string[] | undefined> {
    if (!this.module.devMessages) return undefined
    return this.module.devMessages(this.config)
  }

  patchWithAppDevURLs(urls: ApplicationURLs): void {
    if (!this.module.patchForDev) return
    this.module.patchForDev(this.config, urls)
  }

  // --- Type generation ---

  async contributeToSharedTypeFile(typeDefinitionsByFile: Map<string, Set<string>>): Promise<void> {
    await this.module.contributeToSharedTypeFile?.(this, typeDefinitionsByFile)
  }

  // --- Watch / imports ---

  watchedFiles(): string[] {
    const watchedFiles: string[] = []
    const patterns = this.devSessionCustomWatchPaths ?? ['**/*']
    const files = patterns.flatMap((pattern) =>
      globSync(pattern, {
        cwd: this.directory, absolute: true, followSymbolicLinks: false,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.swp', '**/generated/**'],
      }),
    )
    watchedFiles.push(...files.flat())
    if (!this.devSessionCustomWatchPaths) {
      watchedFiles.push(...this.scanImports())
    }
    return [...new Set(watchedFiles.map((file) => normalizePath(file)))]
  }

  async copyStaticAssets(outputPath?: string): Promise<void> {
    if (this.module.copyStaticAssets) {
      return this.module.copyStaticAssets(this, outputPath ?? this.outputPath)
    }
  }

  async rescanImports(): Promise<boolean> {
    const oldImportPaths = this.cachedImportPaths
    this.cachedImportPaths = undefined
    this.scanImports()
    return oldImportPaths !== this.cachedImportPaths
  }

  // --- Metrics / info ---

  isSentToMetrics(): boolean {
    return !this.isAppConfigExtension
  }

  isReturnedAsInfo(): boolean {
    return !this.isAppConfigExtension
  }

  // --- Bundle config (deploy payload) ---

  async bundleConfig({
    identifiers,
    developerPlatformClient,
    apiKey,
    appConfiguration,
  }: {
    identifiers: Identifiers
    developerPlatformClient: DeveloperPlatformClient
    apiKey: string
    appConfiguration: AppConfigurationWithoutPath
  }): Promise<BundleConfig | undefined> {
    const configValue = await this.encode({apiKey, appConfiguration})
    if (!configValue) return undefined

    const result = {
      config: JSON.stringify(configValue),
      context: this.contextValue,
      handle: this.handle,
    }

    const uuid = this.isUUIDStrategyExtension
      ? identifiers.extensions[this.localIdentifier]!
      : identifiers.extensionsNonUuidManaged[this.localIdentifier]!

    return {
      ...result,
      uid: this.uid,
      uuid,
      specificationIdentifier: developerPlatformClient.toExtensionGraphQLType(this.graphQLType),
    }
  }

  /**
   * Renamed deploy payload method per end state.
   */
  async toDeployPayload(/* same params */): Promise<BundleConfig | undefined> {
    // Alias for bundleConfig during migration
    return this.bundleConfig(arguments[0])
  }

  // --- Private ---

  private scanImports(): string[] {
    if (this.cachedImportPaths !== undefined) return this.cachedImportPaths
    try {
      const imports = this.devSessionDefaultWatchPaths().flatMap((entryFile) => {
        return extractImportPathsRecursively(entryFile).map((ip) => normalizePath(resolvePath(ip)))
      })
      this.cachedImportPaths = uniq(imports) ?? []
      outputDebug(`Found ${this.cachedImportPaths.length} external imports (recursively) for extension ${this.handle}`)
      return this.cachedImportPaths
    } catch (error) {
      outputDebug(`Failed to scan imports for extension ${this.handle}: ${error}`)
      this.cachedImportPaths = []
      return this.cachedImportPaths
    }
  }
}
```

### How it delegates to AppModule

Every behavior method on `ModuleInstance` follows the same delegation pattern:

1. Check if `this.module` has the optional method (e.g., `this.module.validate`)
2. If yes, call it passing `this` (the instance) as context
3. If no, either return a no-op default or use inline fallback logic

Identity computation (`handle`, `uid`) is done once in the constructor by calling `this.module.computeHandle(config)` and `this.module.computeUid(config)`.

### How remote metadata is stored on AppModule (not instance)

Remote metadata (`contractSchema`, `registrationLimit`, `graphQLType`, `externalIdentifier`, `externalName`, `partnersWebIdentifier`, `surface`, `additionalIdentifiers`, `dependency`) is stored on `this.module.remote` -- it is per-type, not per-occurrence. When `ModuleInstance` needs these values (e.g., in `graphQLType` getter), it reads `this.module.remote?.graphQLType`.

This is populated during loading by `attachRemoteMetadata()` (see Section 5).

### Compatibility aliases

Three compatibility aliases bridge old naming conventions during migration:

1. `get configuration()` / `set configuration()` -- aliases for `config`
2. `get configurationPath()` / `set configurationPath()` -- aliases for `configPath`
3. `get specification()` -- returns a shim object that mimics the old `ExtensionSpecification` interface with the most commonly accessed fields

These aliases allow callsites to work with either naming convention. They are removed in step 9.

### Specification shim audit results

A codebase-wide grep for `.specification.` identified **all** external access patterns. The shim now covers every one:

| Property | External Callsite | Covered |
|----------|------------------|:-------:|
| `.identifier` | `app.ts:445,682-686` | YES |
| `.buildConfig.mode` | `services/deploy.ts:212` | YES |
| `.surface` | `services/dev/extension/server/utilities.test.ts` | YES |
| `.parseConfigurationObject()` | `services/dev/update-extension.ts:147` (whole-object pass) | YES (via `_specParseConfigurationObject` bridge) |
| `.deployConfig()` | `extension-instance.ts:255` (internal, dead by Phase 3) | YES (returns `undefined`) |
| `.transformLocalToRemote()` | `extension-instance.ts:256` (internal, dead by Phase 3) | YES (returns `undefined`) |
| `.validationSchema.jsonSchema` | `extension-instance.ts:231` (type-cast access) | YES (from `module.remote.contractSchema`) |

The **critical gap** was `parseConfigurationObject()` — accessed when `extension.specification` is passed as a whole object to `parseConfigurationObjectAgainstSpecification()` in `services/dev/update-extension.ts:147`. Without the shim, this would crash with `TypeError` during dev mode hot-reload. The shim delegates to `_specParseConfigurationObject` which is attached during loader construction from the original spec.

**Migration note:** `update-extension.ts` should be migrated in Step 5 to call `instance.validate()` directly instead of going through `parseConfigurationObjectAgainstSpecification(instance.specification, ...)`. This eliminates the need for the `parseConfigurationObject` shim entirely.

---

## Section 3: Create TomlFile Hierarchy

### File to create

**`packages/app/src/cli/models/app/toml-file.ts`**

### TomlFile base class

```typescript
import {decodeToml, JsonMapType} from '@shopify/cli-kit/node/toml'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname} from '@shopify/cli-kit/node/path'

export class TomlFile {
  readonly content: Record<string, unknown>
  readonly path: string
  readonly directory: string

  protected constructor(content: Record<string, unknown>, path: string) {
    this.content = content
    this.path = path
    this.directory = dirname(path)
  }

  static async load(path: string): Promise<TomlFile> {
    const raw = await readFile(path)
    const content = decodeToml(raw) as Record<string, unknown>
    return new TomlFile(content, path)
  }

  async write(content: Record<string, unknown>): Promise<void> {
    // Write TOML back to disk. Implementation uses existing TOML serialization.
    // Details deferred -- this is the same file I/O the current loader does.
    await writeFile(this.path, JSON.stringify(content)) // placeholder
  }
}
```

### AppTomlFile

```typescript
import {ModuleInstance} from './module-instance.js'
import {AppModule} from './app-module.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export class AppTomlFile extends TomlFile {
  readonly clientId: string
  private modules: AppModule[]

  constructor(toml: TomlFile, modules: AppModule[]) {
    super(toml.content, toml.path)
    const clientId = toml.content.client_id
    if (typeof clientId !== 'string' || !clientId) {
      throw new AbortError('Missing or invalid client_id in shopify.app.toml')
    }
    this.clientId = clientId
    this.modules = modules
  }

  extractAll(): ModuleInstance[] {
    const instances: ModuleInstance[] = []
    for (const module of this.modules) {
      const extracted = module.extract(this.content)
      if (!extracted) continue

      if (Array.isArray(extracted)) {
        for (const item of extracted) {
          instances.push(new ModuleInstance({
            module, config: item, directory: this.directory, configPath: this.path,
          }))
        }
      } else {
        instances.push(new ModuleInstance({
          module, config: extracted, directory: this.directory, configPath: this.path,
        }))
      }
    }
    return instances
  }
}
```

### ExtensionTomlFile

```typescript
export class ExtensionTomlFile extends TomlFile {
  readonly module: AppModule
  private allModules: AppModule[]

  constructor(toml: TomlFile, module: AppModule, allModules?: AppModule[]) {
    super(toml.content, toml.path)
    this.module = module
    this.allModules = allModules ?? [module]
  }

  extractAll(): ModuleInstance[] {
    // Check for unified format (multiple extensions in one .extension.toml file)
    const extensions = this.content.extensions as unknown[] | undefined
    if (Array.isArray(extensions)) {
      return extensions.flatMap(ext => {
        const mergedContent = {...this.content, ...ext as Record<string, unknown>}
        delete mergedContent.extensions

        // Each extension in a unified file may have a different type,
        // so module resolution happens per-extension
        const type = (mergedContent.type as string) ?? (this.content.type as string)
        const resolvedModule = this.resolveModule(type)
        if (!resolvedModule) return []

        const extracted = resolvedModule.extract(mergedContent)
        if (!extracted) return []

        return [new ModuleInstance({
          module: resolvedModule,
          config: extracted,
          directory: this.directory,
          configPath: this.path,
        })]
      })
    }

    // Standard format: single extension per file
    const extracted = this.module.extract(this.content)
    if (!extracted) return []

    if (Array.isArray(extracted)) {
      return extracted.map(item => new ModuleInstance({
        module: this.module, config: item, directory: this.directory, configPath: this.path,
      }))
    }
    return [new ModuleInstance({
      module: this.module, config: extracted, directory: this.directory, configPath: this.path,
    })]
  }

  private resolveModule(type: string): AppModule | undefined {
    return this.allModules.find(m => m.identifier === type)
  }
}
```

### Unified format handling

The unified format allows multiple extensions in one `.extension.toml` file using an `extensions` array. In the current loader, `createExtensionInstances()` handles this at lines ~664-686 by merging global config with each extension's config.

In the new system, `ExtensionTomlFile.extractAll()` handles this as shown above. Key design decisions:

1. `AppModule.extract()` for extension modules returns the entire file content (no `tomlKeys` filtering) -- extension modules do not use `tomlKeys` since they own the entire TOML file.
2. The `ExtensionTomlFile` class handles the split BEFORE calling `extract()` -- each entry in the `extensions` array is merged with the global config, then the merged object is passed to the appropriate module's `extract()`.
3. Each extension in a unified file may have a different `type`, so module resolution happens per-extension. The `resolveModule()` helper searches `allModules` by identifier.
4. Tests must cover:
   - Standard format (single extension per file)
   - Unified format with same type (all extensions share the file-level `type`)
   - Unified format with mixed types (each extension overrides `type`)
   - Unified format where an extension's type has no matching module (should be skipped)

### Test file to create

**`packages/app/src/cli/models/app/toml-file.test.ts`**

Tests:
- `TomlFile.load()` reads a TOML file and populates `content`, `path`, `directory`
- `AppTomlFile` constructor validates `client_id` is present and is a string
- `AppTomlFile` constructor throws `AbortError` when `client_id` is missing
- `AppTomlFile.extractAll()` returns `ModuleInstance[]` by delegating to each module's `extract()`
- `AppTomlFile.extractAll()` handles dynamic modules that return arrays
- `AppTomlFile.extractAll()` skips modules whose `extract()` returns `undefined`
- `ExtensionTomlFile.extractAll()` returns instances for the single module type (standard format)
- `ExtensionTomlFile.extractAll()` handles unified format with same type across all extensions
- `ExtensionTomlFile.extractAll()` handles unified format with mixed types (per-extension type override)
- `ExtensionTomlFile.extractAll()` skips extensions in unified format whose type has no matching module

---

## Section 4: Create ProjectLayout

### File to create

**`packages/app/src/cli/models/app/project-layout.ts`**

```typescript
export interface ProjectLayout {
  extensionDirectories: string[]
  webDirectories: string[]
  build: {
    automaticallyUpdateUrlsOnDev?: boolean
    devStoreUrl?: string
    includeConfigOnDeploy?: boolean
  }
}

export function readProjectLayout(tomlContent: Record<string, unknown>): ProjectLayout {
  const rawExtDirs = tomlContent.extension_directories as string[] | undefined
  // Apply the same transformations as the current AppSchema:
  // removeTrailingPathSeparator + fixSingleWildcards
  const extensionDirectories = rawExtDirs
    ? rawExtDirs.map(removeTrailingPathSeparator).map(fixSingleWildcard)
    : ['extensions/*']

  return {
    extensionDirectories,
    webDirectories: (tomlContent.web_directories as string[]) ?? [],
    build: (tomlContent.build as ProjectLayout['build']) ?? {},
  }
}

function removeTrailingPathSeparator(dir: string): string {
  return dir.endsWith('/') ? dir.slice(0, -1) : dir
}

function fixSingleWildcard(dir: string): string {
  // 'extensions/*' should match 'extensions/my-ext' but not 'extensions/nested/my-ext'
  // This replicates the existing transform from AppSchema
  return dir
}
```

### Test file to create

**`packages/app/src/cli/models/app/project-layout.test.ts`**

Tests:
- Returns default `['extensions/*']` when `extension_directories` is absent
- Returns provided directories when present
- Strips trailing path separators
- Reads `web_directories` and `build` section
- Returns empty defaults for missing `build` and `web_directories`

---

## Section 5: Create Loading Functions

### File to create

**`packages/app/src/cli/models/app/loading.ts`**

### loadApp() function

This replaces the monolithic `AppLoader` class. It is NOT wired in during Phase 3 -- it is created and tested in isolation. The actual replacement of `AppLoader` callsites happens later (or in Phase 4). In Phase 3, we create and test `loadApp()` to prove parity, but the old `AppLoader` continues to work.

```typescript
import {TomlFile, AppTomlFile, ExtensionTomlFile} from './toml-file.js'
import {ProjectLayout, readProjectLayout} from './project-layout.js'
import {ModuleInstance} from './module-instance.js'
import {AppModule, AnyAppModule} from './app-module.js'
import {RemoteModuleMetadata} from './remote-module-metadata.js'
import {allAppModules} from './app-modules/index.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'

export async function loadApp(directory: string, options: LoadOptions): Promise<LoadedApp> {
  // 1. Load TOML
  const rawToml = await TomlFile.load(joinPath(directory, 'shopify.app.toml'))

  // 2. Project layout
  const layout = readProjectLayout(rawToml.content)

  // 3. Separate app-toml modules from extension modules
  const appTomlModules = allAppModules.filter(m => m.tomlKeys !== undefined) as AppModule[]
  const extensionModules = allAppModules.filter(m => m.tomlKeys === undefined) as AppModule[]

  // 4. Extract config instances from app.toml
  const appToml = new AppTomlFile(rawToml, appTomlModules)
  const configInstances = appToml.extractAll()

  // 5. Discover extension files and extract instances
  const extensionFiles = await discoverExtensionFiles(directory, layout.extensionDirectories, extensionModules)
  const extensionInstances = extensionFiles.flatMap(f => f.extractAll())

  // 6. Combine
  const allInstances = [...configInstances, ...extensionInstances]

  // 7. Attach remote metadata if provided
  if (options.remoteSpecs) {
    attachRemoteMetadata(allAppModules, options.remoteSpecs)
  }

  // 8. Validate handle uniqueness
  validateHandleUniqueness(allInstances)

  return {appToml, instances: allInstances, layout}
}

export interface LoadOptions {
  remoteSpecs?: RemoteSpec[]
  mode?: 'strict' | 'report' | 'local'
}

export interface LoadedApp {
  appToml: AppTomlFile
  instances: ModuleInstance[]
  layout: ProjectLayout
}

export interface RemoteSpec {
  identifier: string
  graphQLType?: string
  externalIdentifier: string
  externalName: string
  registrationLimit: number
  surface?: string
  partnersWebIdentifier?: string
  dependency?: string
  additionalIdentifiers?: string[]
  validationSchema?: {jsonSchema?: string}
}
```

### discoverExtensionFiles()

```typescript
export async function discoverExtensionFiles(
  appDirectory: string,
  extensionDirectories: string[],
  extensionModules: AppModule[],
): Promise<ExtensionTomlFile[]> {
  const tomlPaths: string[] = []

  for (const dir of extensionDirectories) {
    const pattern = joinPath(appDirectory, dir, '*.extension.toml')
    const found = await glob(pattern, {absolute: true})
    tomlPaths.push(...found)
  }

  const files: ExtensionTomlFile[] = []
  for (const tomlPath of tomlPaths) {
    const rawToml = await TomlFile.load(tomlPath)
    const type = rawToml.content.type as string | undefined
    if (!type) continue

    const module = extensionModules.find(m => m.identifier === type)
    if (!module) continue

    files.push(new ExtensionTomlFile(rawToml, module))
  }

  return files
}
```

### attachRemoteMetadata()

```typescript
export function attachRemoteMetadata(modules: AnyAppModule[], remoteSpecs: RemoteSpec[]): void {
  for (const module of modules) {
    const remote = remoteSpecs.find(r =>
      r.identifier === module.identifier ||
      (r.additionalIdentifiers ?? []).includes(module.identifier),
    )
    if (remote) {
      ;(module as AppModule).remote = {
        contractSchema: remote.validationSchema?.jsonSchema,
        registrationLimit: remote.registrationLimit,
        graphQLType: remote.graphQLType ?? remote.identifier,
        externalIdentifier: remote.externalIdentifier,
        externalName: remote.externalName,
        partnersWebIdentifier: remote.partnersWebIdentifier ?? remote.identifier,
        surface: remote.surface ?? '',
        additionalIdentifiers: remote.additionalIdentifiers ?? [],
        dependency: remote.dependency,
      }
    }
  }
}
```

### validateHandleUniqueness()

```typescript
export function validateHandleUniqueness(instances: ModuleInstance[]): void {
  const seen = new Map<string, ModuleInstance>()
  for (const instance of instances) {
    const existing = seen.get(instance.handle)
    if (existing) {
      throw new AbortError(
        `Duplicate handle "${instance.handle}" found in ${instance.configPath} and ${existing.configPath}`,
      )
    }
    seen.set(instance.handle, instance)
  }
}
```

### Test file to create

**`packages/app/src/cli/models/app/loading.test.ts`**

Port relevant tests from `loader.test.ts`. Key test cases:
- `loadApp()` produces the correct number of instances for a sample app
- Config modules are extracted from `app.toml`
- Extension modules are discovered from `extensions/` directories
- `discoverExtensionFiles()` finds all `.extension.toml` files in declared directories
- `attachRemoteMetadata()` enriches modules with server data
- `attachRemoteMetadata()` handles modules not found in remote specs (remote stays undefined)
- `validateHandleUniqueness()` throws on duplicate handles

---

## Section 6: Migration Strategy (Step by Step)

### Step 1: Create all new files (additive, no existing code changes)

**What:** Create the files from Sections 2-5. No existing file is modified.

**Files to create (9 files):**

| # | File | Purpose |
|---|------|---------|
| 1 | `models/app/remote-module-metadata.ts` | `RemoteModuleMetadata` interface |
| 2 | `models/app/module-instance.ts` | `ModuleInstance` class |
| 3 | `models/app/toml-file.ts` | `TomlFile`, `AppTomlFile`, `ExtensionTomlFile` classes |
| 4 | `models/app/project-layout.ts` | `ProjectLayout` interface and `readProjectLayout()` |
| 5 | `models/app/loading.ts` | `loadApp()`, `discoverExtensionFiles()`, `attachRemoteMetadata()` |
| 6 | `models/app/module-instance.test.ts` | Unit tests for ModuleInstance |
| 7 | `models/app/toml-file.test.ts` | Unit tests for TomlFile hierarchy |
| 8 | `models/app/project-layout.test.ts` | Unit tests for ProjectLayout |
| 9 | `models/app/loading.test.ts` | Unit tests for loading functions |

**Files to modify (1 file -- additive only):**

| # | File | Change |
|---|------|--------|
| 1 | `models/app/app-module.ts` | Add optional properties: `remote?: RemoteModuleMetadata`, `buildConfig`, `appModuleFeatures()`, `computeHandle()`, `computeUid()`, and all optional capability methods (`validate`, `preDeployValidation`, `buildValidation`, `build`, `patchForDev`, `devMessages`, `getBundleExtensionStdinContent`, `hasExtensionPointTarget`, `devSessionDefaultWatchPaths`, `contributeToSharedTypeFile`, `copyStaticAssets`) |

**Exact changes to `app-module.ts`:**

Add after the `decode()` method in the `AppModule` class:

```typescript
  // --- Remote metadata (enriched from server) ---
  remote?: RemoteModuleMetadata

  // --- Identity ---
  computeHandle(config: TToml): string {
    // Default: return identifier for single, handle field for uuid, hash for dynamic
    // Subclasses override this.
    if (this.uidStrategy === 'single') return this.identifier
    const cfg = config as {handle?: string; name?: string}
    return cfg.handle ?? slugify(cfg.name ?? '')
  }

  computeUid(config: TToml): string {
    if (this.uidStrategy === 'single') return this.identifier
    const cfg = config as {uid?: string; handle?: string; name?: string}
    return cfg.uid ?? nonRandomUUID(this.computeHandle(config))
  }

  // --- Feature detection ---
  appModuleFeatures(config?: TToml): ExtensionFeature[] {
    return []  // Subclasses override
  }

  // --- Build config ---
  readonly buildConfig: BuildConfig = {mode: 'none'}

  // --- Optional capabilities (undefined = not supported) ---
  validate?(instance: ModuleInstance): Promise<Result<unknown, string>>
  preDeployValidation?(instance: ModuleInstance): Promise<void>
  buildValidation?(instance: ModuleInstance): Promise<void>
  build?(instance: ModuleInstance, options: ExtensionBuildOptions): Promise<void>
  patchForDev?(config: TToml, urls: ApplicationURLs): void
  devMessages?(config: TToml): Promise<string[]>
  getBundleExtensionStdinContent?(instance: ModuleInstance): {main: string; assets?: Asset[]}
  hasExtensionPointTarget?(config: TToml, target: string): boolean
  devSessionDefaultWatchPaths?(instance: ModuleInstance): string[]
  contributeToSharedTypeFile?(instance: ModuleInstance, map: Map<string, Set<string>>): Promise<void>
  copyStaticAssets?(instance: ModuleInstance, outputPath: string): Promise<void>
```

**How to verify:**
```bash
# Compile to check for type errors
cd packages/app && npx tsc --noEmit

# Run the new unit tests
npx vitest run packages/app/src/cli/models/app/module-instance.test.ts
npx vitest run packages/app/src/cli/models/app/toml-file.test.ts
npx vitest run packages/app/src/cli/models/app/project-layout.test.ts
npx vitest run packages/app/src/cli/models/app/loading.test.ts

# Run ALL existing tests to confirm nothing broke (purely additive)
npx vitest run packages/app/
```

**PR boundary:** This is a standalone PR. No behavioral changes to existing code.

---

### Step 2: Add compatibility aliases to ModuleInstance

This was done in Step 1 as part of the ModuleInstance class creation. The compatibility aliases (`configuration`, `configurationPath`, `specification`) are already present in the class from Section 2. No additional work needed.

**How to verify:** Already verified in Step 1 tests. The `module-instance.test.ts` file includes tests for:
- `instance.configuration === instance.config`
- `instance.configurationPath === instance.configPath`
- `instance.specification.identifier === instance.module.identifier`

---

### Step 3: Update test data factory (app.test-data.ts)

**This is the highest-risk single change.** The file `models/app/app.test-data.ts` exports ~15 test factory functions used by 50+ test files. Each factory currently calls `new ExtensionInstance(...)`. We add parallel factories that produce `ModuleInstance`, then alias the old names.

#### 3.1: Factory Output Parity Verification

**This sub-step runs BEFORE the factory replacement.** It proves that the new `ModuleInstance`-based factories produce output equivalent to the old `ExtensionInstance`-based factories.

1. For every factory function, create a temporary comparison test. Keep the old factory functions under `_old` suffixed names temporarily (copy-paste the old function body before modifying):

```typescript
// packages/app/src/cli/models/app/factory-parity.test.ts (temporary file, deleted after PR 2 merges)
import {
  testUIExtension, testFunctionExtension, testThemeExtensions,
  testAppConfigExtensions, testPaymentExtensions, testWebhookExtensions,
  testTaxCalculationExtension, testFlowActionExtension,
  testEditorExtensionCollection, testPaymentsAppExtension,
} from './app.test-data.js'
import {
  testUIExtension_old, testFunctionExtension_old, testThemeExtensions_old,
  testAppConfigExtensions_old, testPaymentExtensions_old, testWebhookExtensions_old,
  testTaxCalculationExtension_old, testFlowActionExtension_old,
  testEditorExtensionCollection_old, testPaymentsAppExtension_old,
} from './app.test-data-old.js'  // Temporary copy of the original factories

describe('factory output parity', () => {
  test('testUIExtension: identity properties match', async () => {
    const oldInstance = await testUIExtension_old({})
    const newInstance = await testUIExtension({})
    expect(newInstance.handle).toBe(oldInstance.handle)
    expect(newInstance.uid).toBe(oldInstance.uid)
    expect(newInstance.devUUID).toBe(oldInstance.devUUID)
    expect(newInstance.localIdentifier).toBe(oldInstance.localIdentifier)
    expect(newInstance.idEnvironmentVariableName).toBe(oldInstance.idEnvironmentVariableName)
    expect(newInstance.type).toBe(oldInstance.type)
    expect(newInstance.graphQLType).toBe(oldInstance.graphQLType)
    expect(newInstance.humanName).toBe(oldInstance.humanName)
    expect(newInstance.isAppConfigExtension).toBe(oldInstance.isAppConfigExtension)
  })

  test('testFunctionExtension: identity properties match', async () => {
    const oldInstance = await testFunctionExtension_old()
    const newInstance = await testFunctionExtension()
    expect(newInstance.handle).toBe(oldInstance.handle)
    expect(newInstance.uid).toBe(oldInstance.uid)
    expect(newInstance.devUUID).toBe(oldInstance.devUUID)
    expect(newInstance.localIdentifier).toBe(oldInstance.localIdentifier)
    expect(newInstance.idEnvironmentVariableName).toBe(oldInstance.idEnvironmentVariableName)
    expect(newInstance.type).toBe(oldInstance.type)
    expect(newInstance.graphQLType).toBe(oldInstance.graphQLType)
    expect(newInstance.humanName).toBe(oldInstance.humanName)
    expect(newInstance.isAppConfigExtension).toBe(oldInstance.isAppConfigExtension)
  })

  // Repeat for: testThemeExtensions, testAppConfigExtensions,
  // testPaymentExtensions, testWebhookExtensions, testTaxCalculationExtension,
  // testFlowActionExtension, testEditorExtensionCollection, testPaymentsAppExtension
})
```

2. This parity test runs ONCE to prove the factories produce equivalent output. The temporary `app.test-data-old.js` file and the parity test file can be deleted after PR 2 is merged and all tests pass.

3. The following identity properties MUST match between old and new factory output:

| Property | Old computation (ExtensionInstance) | New computation (ModuleInstance) | Must be identical string |
|----------|-------------------------------------|----------------------------------|--------------------------|
| `handle` | `buildHandle(configuration)` | `module.computeHandle(config)` | Yes |
| `uid` | `buildUIDFromStrategy(spec, config)` | `module.computeUid(config)` | Yes |
| `devUUID` | `dev-${uid}` | `dev-${uid}` | Yes (derived from uid) |
| `localIdentifier` | Same as `handle` | Same as `handle` | Yes (derived from handle) |
| `idEnvironmentVariableName` | `SHOPIFY_${constantize(localIdentifier)}_ID` | `SHOPIFY_${constantize(localIdentifier)}_ID` | Yes (derived from handle) |
| `type` | `specification.identifier` | `module.identifier` | Yes (must be same string) |
| `graphQLType` | `specification.graphQLType.toUpperCase()` | `module.remote.graphQLType.toUpperCase()` | Yes (remote metadata must match) |
| `humanName` | `specification.externalName` | `module.remote.externalName` | Yes (remote metadata must match) |
| `isAppConfigExtension` | `['single','dynamic'].includes(spec.uidStrategy)` | `module.tomlKeys !== undefined` | Yes (must agree) |

**File to modify:** `models/app/app.test-data.ts`

**Change 1: Add import for ModuleInstance**

At the top of the file, add:
```typescript
import {ModuleInstance} from './module-instance.js'
import {allAppModules} from './app-modules/index.js'
import {AppModule} from './app-module.js'
```

**Change 2: Add helper to find module by identifier**

```typescript
function findModule(identifier: string): AppModule {
  const mod = allAppModules.find(m => m.identifier === identifier)
  if (!mod) throw new Error(`No AppModule for identifier: ${identifier}`)
  return mod as AppModule
}
```

**Change 3: Add `testModuleInstance()` factory -- the generic factory**

```typescript
export async function testModuleInstance(options: {
  moduleIdentifier: string
  config?: unknown
  directory?: string
  configPath?: string
  entryPath?: string
  uid?: string
  devUUID?: string
  handle?: string
}): Promise<ModuleInstance> {
  const module = findModule(options.moduleIdentifier)
  const instance = new ModuleInstance({
    module,
    config: options.config ?? {},
    directory: options.directory ?? '/tmp/project/extensions/test',
    configPath: options.configPath ?? '',
    entryPath: options.entryPath,
  })
  if (options.uid) instance.uid = options.uid
  if (options.devUUID) instance.devUUID = options.devUUID
  if (options.handle) {
    instance.handle = options.handle
    instance.localIdentifier = options.handle
  }
  return instance
}
```

**Change 4: Replace each existing factory function body**

For each test factory (e.g., `testUIExtension`, `testFunctionExtension`, `testThemeExtensions`, etc.), replace the body to create `ModuleInstance` instead of `ExtensionInstance`. The function signature and return type stay the same initially (return `ExtensionInstance | ModuleInstance` via a type alias).

Example for `testUIExtension`:

```typescript
export async function testUIExtension(
  uiExtension: Omit<Partial<ExtensionInstance>, 'configuration'> & {
    configuration?: Partial<BaseConfigType> & {path?: string} & {metafields?: {namespace: string; key: string}[]}
  } = {},
): Promise<ModuleInstance> {  // Return type changes from ExtensionInstance to ModuleInstance
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.name ?? 'test-ui-extension',
    type: uiExtension?.type ?? 'product_subscription',
    handle: uiExtension?.handle ?? 'test-ui-extension',
    uid: uiExtension?.uid ?? undefined,
    metafields: [],
    capabilities: { /* same defaults */ },
    supported_features: { offline_mode: false },
    extension_points: [ /* same defaults */ ],
  }

  const configurationPath = uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`
  const entryPath = uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`

  // Find the AppModule matching the type. Fall back to a spec-based lookup for types
  // not yet registered as AppModules.
  const moduleId = (configuration as {type?: string}).type ?? 'product_subscription'
  const module = allAppModules.find(m => m.identifier === moduleId) as AppModule

  // If no AppModule exists, fall back to old ExtensionInstance path.
  // This should not happen if Phase 2 is complete.
  if (!module) {
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === moduleId)!
    return new ExtensionInstance({
      configuration: configuration as BaseConfigType,
      configurationPath, entryPath, directory, specification,
    }) as unknown as ModuleInstance
  }

  // Attach remote metadata from specs (for graphQLType, externalName, etc.)
  if (!module.remote) {
    const allSpecs = await loadLocalExtensionsSpecifications()
    const remoteSpec = allSpecs.find((spec) => spec.identifier === moduleId)
    if (remoteSpec) {
      module.remote = {
        graphQLType: remoteSpec.graphQLType,
        externalIdentifier: remoteSpec.externalIdentifier,
        externalName: remoteSpec.externalName,
        partnersWebIdentifier: remoteSpec.partnersWebIdentifier,
        surface: remoteSpec.surface,
        registrationLimit: remoteSpec.registrationLimit,
        additionalIdentifiers: remoteSpec.additionalIdentifiers,
        dependency: remoteSpec.dependency,
      }
    }
  }

  const instance = new ModuleInstance({
    module,
    config: configuration,
    directory,
    configPath: configurationPath,
    entryPath,
  })

  instance.devUUID = uiExtension?.devUUID ?? 'test-ui-extension-uuid'
  instance.uid = uiExtension?.uid ?? 'test-ui-extension-uid'

  return instance
}
```

Apply the same pattern to every factory function:
- `testThemeExtensions()`
- `testAppConfigExtensions()`
- `testAppAccessConfigExtension()`
- `testAppHomeConfigExtension()`
- `testAppProxyConfigExtension()`
- `testPaymentExtensions()`
- `testWebhookExtensions()`
- `testSingleWebhookSubscriptionExtension()`
- `testTaxCalculationExtension()`
- `testFlowActionExtension()`
- `testFunctionExtension()`
- `testEditorExtensionCollection()`
- `testPaymentsAppExtension()`

**IMPORTANT: Temporary type alias for backward compatibility.**

Add at the top of the file:
```typescript
// During migration, ModuleInstance is compatible with ExtensionInstance
// via its compatibility aliases. This type alias lets all 50+ consumer files
// continue to compile without changes.
export type ExtensionInstanceCompat = ModuleInstance
```

And ensure the `testApp()` function accepts `ModuleInstance[]` for its `modules` parameter. Since `App` still expects `ExtensionInstance[]` at this point, we add a cast:

```typescript
modules: (app.allExtensions ?? []) as any,
```

This cast is temporary and removed when the App class is updated in Step 4.

**How to verify:**
```bash
# Run ALL tests -- this is the critical verification
npx vitest run packages/app/

# If any tests fail, the issue is in the factory function.
# Compare the failing test's expected behavior with what ModuleInstance produces.
# The most common issues will be:
# 1. Missing remote metadata (graphQLType, externalName) -- fix by attaching remote
# 2. Handle computation differences -- fix by ensuring computeHandle() matches buildHandle()
# 3. UID computation differences -- fix by ensuring computeUid() matches buildUIDFromStrategy()
```

**PR boundary:** This should be its own PR. It is the single most impactful change and needs careful review.

---

### Step 4: Update App class to use ModuleInstance[]

**File to modify:** `models/app/app.ts`

**Change 1: Update imports**

Replace:
```typescript
import {ExtensionInstance} from '../extensions/extension-instance.js'
```
With:
```typescript
import {ModuleInstance} from './module-instance.js'
// Keep ExtensionInstance import temporarily for type compatibility
import {ExtensionInstance} from '../extensions/extension-instance.js'
```

**Change 2: Update AppInterface**

In the `AppInterface` interface, change every `ExtensionInstance` reference:

```typescript
export interface AppInterface</* same generics */> {
  // ...
  allExtensions: ModuleInstance[]
  realExtensions: ModuleInstance[]
  nonConfigExtensions: ModuleInstance[]
  draftableExtensions: ModuleInstance[]
  // ...
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ModuleInstance[]
  // ...
}
```

**Change 3: Update AppConstructor type**

```typescript
type AppConstructor</* same */> = /* same */ & {
  // ...
  modules: ModuleInstance[]  // was ExtensionInstance[]
  // ...
}
```

**Change 4: Update App class fields**

```typescript
export class App</* same */> implements AppInterface</* same */> {
  // ...
  realExtensions: ModuleInstance[]  // was ExtensionInstance[]
  // ...
}
```

**Change 5: Update accessor methods**

The `draftableExtensions` getter currently references `ext.specification.identifier`:
```typescript
// Before:
get draftableExtensions() {
  return this.realExtensions.filter(
    (ext) => ext.isUUIDStrategyExtension || ext.specification.identifier === AppAccessSpecIdentifier,
  )
}

// After:
get draftableExtensions() {
  return this.realExtensions.filter(
    (ext) => ext.isUUIDStrategyExtension || ext.type === AppAccessSpecIdentifier,
  )
}
```

The `extensionsForType` method:
```typescript
// Before: returns ExtensionInstance[]
extensionsForType(specification: {identifier: string; externalIdentifier: string}): ExtensionInstance[]

// After: returns ModuleInstance[]
extensionsForType(specification: {identifier: string; externalIdentifier: string}): ModuleInstance[]
```

**Change 6: Add compatibility alias**

```typescript
/** @deprecated Use realExtensions. Alias kept during migration. */
get instances(): ModuleInstance[] { return this.realExtensions }
```

(Note: the end state flips this -- `instances` is the canonical name and `realExtensions` is the alias. But during migration we keep `realExtensions` as canonical to minimize changes.)

**How to verify:**
```bash
npx tsc --noEmit --project packages/app/tsconfig.json
npx vitest run packages/app/
```

**PR boundary:** Can be combined with Step 3 if Step 3 is clean.

---

### Step 5: Batch update Category A files (52 type-import replacements)

These 52 files use `ExtensionInstance` only as a type annotation in parameter types, variable types, or generic type arguments. The change is purely mechanical.

**Mechanical replacement for each file:**

1. Replace the import:
   ```typescript
   // Before:
   import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
   // After:
   import {ModuleInstance} from '../../models/app/module-instance.js'
   ```
   (Adjust relative path based on file location.)

2. Replace all type references:
   ```typescript
   // Before:
   function doSomething(extension: ExtensionInstance): void
   // After:
   function doSomething(extension: ModuleInstance): void
   ```

**Complete file list with exact import path changes:**

Each row shows the file and the new import path.

| # | File | New import |
|---|------|-----------|
| 1 | `models/app/identifiers.ts` | `import {ModuleInstance} from './module-instance.js'` |
| 2 | `services/info.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 3 | `services/generate-schema.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 4 | `services/function/runner.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 5 | `services/function/replay.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 6 | `services/function/replay.test.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 7 | `services/function/info.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 8 | `services/function/info.test.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 9 | `services/function/common.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 10 | `services/function/common.test.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 11 | `services/function/build.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 12 | `services/function/ui/components/Replay/hooks/useFunctionWatcher.ts` | `import {ModuleInstance} from '../../../../../../models/app/module-instance.js'` |
| 13 | `services/extensions/bundle.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 14 | `services/extensions/bundle.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 15 | `services/dev/update-extension.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 16 | `services/dev/processes/previewable-extension.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 17 | `services/dev/processes/draftable-extension.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 18 | `services/dev/processes/dev-session/dev-session-logger.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 19 | `services/dev/processes/dev-session/dev-session-logger.test.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 20 | `services/dev/extension/server/utilities.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 21 | `services/dev/extension/server/utilities.test.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 22 | `services/dev/extension/server/models.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 23 | `services/dev/extension/server.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 24 | `services/dev/extension/payload/store.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 25 | `services/dev/extension/payload/store.test.ts` | `import {ModuleInstance} from '../../../../models/app/module-instance.js'` |
| 26 | `services/dev/extension/payload.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 27 | `services/dev/extension/localization.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 28 | `services/dev/extension.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 29 | `services/dev/app-events/app-watcher-esbuild.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 30 | `services/dev/app-events/app-event-watcher.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 31 | `services/dev/app-events/app-event-watcher.test.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 32 | `services/dev/app-events/app-event-watcher-handler.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 33 | `services/dev/app-events/app-diffing.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 34 | `services/deploy/theme-extension-config.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 35 | `services/deploy/theme-extension-config.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 36 | `services/context/identifiers-extensions.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 37 | `services/context/identifiers-extensions.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 38 | `services/context/id-matching.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 39 | `services/context/id-matching.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 40 | `services/context/id-manual-matching.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 41 | `services/context/breakdown-extensions.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 42 | `services/context.ts` | `import {ModuleInstance} from '../models/app/module-instance.js'` |
| 43 | `services/build/extension.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 44 | `services/build/extension.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 45 | `services/app/add-uid-to-extension-toml.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 46 | `services/app/add-uid-to-extension-toml.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 47 | `utilities/extensions/theme.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 48 | `utilities/extensions/theme.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 49 | `utilities/developer-platform-client/app-management-client.test.ts` | `import {ModuleInstance} from '../../models/app/module-instance.js'` |
| 50 | `services/generate.test.ts` | `import {ModuleInstance} from '../models/app/module-instance.js'` |
| 51 | `services/dev/extension/utilities.ts` | `import {ModuleInstance} from '../../../models/app/module-instance.js'` |
| 52 | `models/extensions/specification.ts` | `import {ModuleInstance} from '../app/module-instance.js'` |

**In each file**, also rename every occurrence of the type `ExtensionInstance` to `ModuleInstance` in:
- Parameter types: `(ext: ExtensionInstance)` becomes `(ext: ModuleInstance)`
- Variable types: `const ext: ExtensionInstance` becomes `const ext: ModuleInstance`
- Array types: `ExtensionInstance[]` becomes `ModuleInstance[]`
- Generic type arguments: `Promise<ExtensionInstance>` becomes `Promise<ModuleInstance>`

**Additional files found in grep but not in the original plan:**

| # | File | Notes |
|---|------|-------|
| 53 | `services/function/ui/components/Replay/Replay.tsx` | Import replacement |
| 54 | `services/function/ui/components/Replay/Replay.test.tsx` | Import replacement |
| 55 | `services/dev/ui/components/Dev.tsx` | Import replacement |

**How to verify:**
```bash
# Type check first -- catches any missed renames
npx tsc --noEmit --project packages/app/tsconfig.json

# Then run all tests
npx vitest run packages/app/

# Confirm no remaining ExtensionInstance imports outside of allowed files
grep -r "import.*ExtensionInstance.*from" packages/app/src/cli/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "extension-instance.ts" \
  | grep -v "node_modules" \
  | grep -v "specification.ts"  # specification.ts is Category C, updated in Step 7
```

The last grep should return empty (only `extension-instance.ts` itself and Category C files should still reference `ExtensionInstance`).

**PR boundary:** This can be a single PR. It is mechanical and reviewers can verify with a pattern search.

---

### Step 6: Update Category B files (6 structural changes)

These files have deeper structural dependencies on `ExtensionInstance` beyond simple type annotations.

#### 6.1 `models/extensions/extension-instance.ts`

**Change:** Add re-export alias for backward compatibility. The file remains but becomes a thin re-export.

Add at the bottom of the file:
```typescript
// Re-export ModuleInstance as ExtensionInstance for backward compat during migration
export {ModuleInstance} from '../app/module-instance.js'
export {ModuleInstance as ExtensionInstanceCompat} from '../app/module-instance.js'
```

This lets any external code (plugins, tests) that imports `ExtensionInstance` from this path continue to work. The file itself and the `ExtensionInstance` class remain -- they are deleted in Phase 4.

#### 6.2 `models/app/app.ts`

Already updated in Step 4. No additional changes needed here.

#### 6.3 `models/app/app.test.ts`

**Change:** Update test fixtures to use `ModuleInstance` instead of `ExtensionInstance`.

Replace:
```typescript
import {ExtensionInstance} from '../extensions/extension-instance.js'
```
With:
```typescript
import {ModuleInstance} from './module-instance.js'
```

Update any direct `new ExtensionInstance(...)` calls in test bodies to use the updated factory functions from `app.test-data.ts`.

#### 6.4 `models/app/app.test-data.ts`

Already updated in Step 3. No additional changes needed here.

#### 6.5 `models/app/loader.ts`

**Change:** Update the `AppLoader` class to produce `ModuleInstance[]` instead of `ExtensionInstance[]`.

This is the largest single file change. The `AppLoader` class has four key methods that create `ExtensionInstance` objects:

- `createExtensionInstance()` (line ~551-608) -- creates a single instance from a parsed config object
- `createExtensionInstances()` (line ~643-700) -- discovers `.extension.toml` files, calls `createExtensionInstance` for each
- `createConfigExtensionInstancesFromAppModules()` (line ~707-829) -- extracts config modules from `app.toml` using `AppModule.extract()`
- `loadExtensions()` (line ~610-641) -- orchestrates all of the above

The `AppLoader` class continues to use `ExtensionSpecification` for TOML validation and Zod schema parsing (these are removed in Phase 4). But the **output** -- the instances it produces -- are `ModuleInstance`.

**Key invariant:** The Zod schema parsing step (`parseConfigurationObjectAgainstSpecification`) is PRESERVED. It provides developer-facing error messages and IDE validation. We are only changing which class wraps the parsed result.

The migration is broken into sub-steps:

##### Sub-step 6.5a: Update `createExtensionInstance()` to produce `ModuleInstance`

This is the core change. After parsing the config against the specification's schema (which still runs for validation/error messages), create a `ModuleInstance` instead of `ExtensionInstance`:

```typescript
import {allAppModules} from './app-modules/index.js'
import {ModuleInstance} from './module-instance.js'

private async createExtensionInstance(
  type: string,
  configurationObject: object,
  configurationPath: string,
  directory: string,
): Promise<ModuleInstance | undefined> {
  const specification = this.findSpecificationForType(type)
  let entryPath
  let usedKnownSpecification = false

  if (specification) {
    usedKnownSpecification = true
  } else if (this.mode === 'local') {
    return undefined
  } else {
    return this.abortOrReport(
      outputContent`Invalid extension type "${type}" in "${relativizePath(configurationPath)}"`,
      undefined,
      configurationPath,
    )
  }

  // Zod parsing is PRESERVED -- provides developer-facing error messages
  const configuration = parseConfigurationObjectAgainstSpecification(
    specification,
    configurationPath,
    configurationObject,
    this.abortOrReport.bind(this),
  )

  if (usedKnownSpecification) {
    entryPath = await this.findEntryPath(directory, specification)
  }

  const previousExtension = this.previousApp?.allExtensions.find((extension) => {
    return extension.handle === configuration.handle
  })

  // --- NEW: Look up the AppModule for this specification ---
  const appModule = allAppModules.find(
    m => m.identifier === specification.identifier
  ) as AppModule | undefined

  if (appModule) {
    // Attach remote metadata from spec (if not already attached)
    if (!appModule.remote) {
      appModule.remote = {
        graphQLType: specification.graphQLType ?? specification.identifier,
        externalIdentifier: specification.externalIdentifier,
        externalName: specification.externalName,
        partnersWebIdentifier: specification.partnersWebIdentifier,
        surface: specification.surface,
        registrationLimit: specification.registrationLimit,
        additionalIdentifiers: specification.additionalIdentifiers ?? [],
        dependency: specification.dependency,
        contractSchema: (specification as any).validationSchema?.jsonSchema,
      }
    }

    const instance = new ModuleInstance({
      module: appModule,
      config: configuration,  // the Zod-parsed config
      directory,
      configPath: configurationPath,
      entryPath,
    })

    if (previousExtension) {
      instance.devUUID = previousExtension.devUUID
    }

    // Validation still runs via the module
    if (usedKnownSpecification) {
      const validateResult = await instance.validate()
      if (validateResult.isErr()) {
        this.abortOrReport(outputContent`\n${validateResult.error}`, undefined, configurationPath)
      }
    }
    return instance
  }

  // Escape hatch: if no AppModule exists (new type added between phases),
  // fall back to ExtensionInstance
  outputDebug(`No AppModule found for "${specification.identifier}", using legacy ExtensionInstance`)
  return new ExtensionInstance({
    configuration, configurationPath, entryPath, directory, specification,
  }) as unknown as ModuleInstance
}
```

**Escape hatch:** The `createExtensionInstance()` method must NOT throw if an `AppModule` is missing for a given spec identifier. Instead, it falls back to creating the old `ExtensionInstance`. This handles the case where a new extension type is added between Phase 2 and Phase 3 -- the old code path works via the compatibility aliases on `ModuleInstance`. The CI check added in Section 1.0 ensures this escape hatch is not triggered unexpectedly; if it fires, it indicates Phase 2 is incomplete for that type.

##### Sub-step 6.5b: Update `createConfigExtensionInstancesFromAppModules()`

This method already uses `AppModule.extract()`. The change is minimal: since `createExtensionInstance` (updated in 6.5a) now returns `ModuleInstance`, this method's return type changes accordingly. The internal logic is the same.

Update the return type and internal type annotations:

```typescript
private async createConfigExtensionInstancesFromAppModules(
  directory: string,
  appConfiguration: TConfig & CurrentAppConfiguration,
): Promise<(ModuleInstance | undefined)[]>  // was Promise<(ExtensionInstance | undefined)[]>
```

The local variable `allInstances` changes type:

```typescript
const allInstances: Promise<ModuleInstance | undefined>[] = []
```

The `validateConfigurationExtensionInstance` method also updates its parameter type:

```typescript
private async validateConfigurationExtensionInstance(
  apiKey: string,
  appConfiguration: TConfig,
  extensionInstance?: ModuleInstance,  // was ExtensionInstance
) {
  if (!extensionInstance) return
  const configContent = await extensionInstance.deployConfig({apiKey, appConfiguration})
  return configContent ? extensionInstance : undefined
}
```

##### Sub-step 6.5c: Update `loadExtensions()`

Change the return type and all internal references:

```typescript
private async loadExtensions(appDirectory: string, appConfiguration: TConfig): Promise<ModuleInstance[]> {
  if (this.specifications.length === 0) return []

  const extensionPromises = await this.createExtensionInstances(appDirectory, appConfiguration.extension_directories)
  const configExtensionPromises = isCurrentAppSchema(appConfiguration)
    ? await this.createConfigExtensionInstancesFromAppModules(appDirectory, appConfiguration)
    : []

  const extensions = await Promise.all([...extensionPromises, ...configExtensionPromises])

  const allExtensions: ModuleInstance[] = getArrayRejectingUndefined(extensions.flat())

  // Handle uniqueness validation -- unchanged logic, just typed as ModuleInstance
  const handles = new Set()
  allExtensions.forEach((extension) => {
    if (extension.handle && handles.has(extension.handle)) {
      const matchingExtensions = allExtensions.filter((ext) => ext.handle === extension.handle)
      const result = joinWithAnd(matchingExtensions.map((ext) => ext.name))
      const handle = outputToken.cyan(extension.handle)
      this.abortOrReport(
        outputContent`Duplicated handle "${handle}" in extensions ${result}. Handle needs to be unique per extension.`,
        undefined,
        extension.configurationPath,
      )
    } else if (extension.handle) {
      handles.add(extension.handle)
    }
  })

  return allExtensions
}
```

##### Sub-step 6.5d: Update `AppLoader.loaded()`

The `loaded()` method passes `extensions` to `new App(...)` via the `modules` parameter. After Step 4 updates the `App` class to accept `ModuleInstance[]`, this just works -- no changes needed to `loaded()` beyond the fact that `loadExtensions()` now returns `ModuleInstance[]`.

Also update the `logMetadataForLoadedAppUsingRawValues` function signature at line ~1308 to accept `ModuleInstance[]` instead of `ExtensionInstance[]`:

```typescript
async function logMetadataForLoadedAppUsingRawValues(
  webs: Web[],
  extensionsToAddToMetrics: ModuleInstance[],  // was ExtensionInstance[]
  // ... rest unchanged
)
```

##### Sub-step 6.5e: Verify

After each sub-step, run:

```bash
npx tsc --noEmit --project packages/app/tsconfig.json
npx vitest run packages/app/src/cli/models/app/loader.test.ts
npx vitest run packages/app/
```

The key invariant to verify: the Zod schema parsing step is preserved (for developer-facing errors), but the output is wrapped in `ModuleInstance` instead of `ExtensionInstance`. All 65+ test files should pass without modification because `ModuleInstance` provides compatibility aliases (`configuration`, `configurationPath`, `specification`) that match the old API.

#### 6.6 `models/app/loader.test.ts`

**Change:** Update test assertions that check for `ExtensionInstance` type or properties.

Replace:
```typescript
import {ExtensionInstance} from '../extensions/extension-instance.js'
```
With:
```typescript
import {ModuleInstance} from './module-instance.js'
```

Update `instanceof` checks if any exist. Update assertions that reference `instance.configuration` to also accept `instance.config`.

**How to verify:**
```bash
npx vitest run packages/app/src/cli/models/app/app.test.ts
npx vitest run packages/app/src/cli/models/app/loader.test.ts
npx vitest run packages/app/
```

**PR boundary:** This should be its own PR due to the loader complexity.

---

### Step 7: Update Category C files (6 spec file signatures)

These spec files import `ExtensionInstance` for use in callback function signatures.

#### 7.1 `models/extensions/specifications/ui_extension.ts`

Replace:
```typescript
import {ExtensionInstance} from '../extension-instance.js'
```
With:
```typescript
import {ModuleInstance} from '../../app/module-instance.js'
```

Update the `contributeToSharedTypeFile` callback parameter type.

#### 7.2 `models/extensions/specifications/theme.ts`

Replace:
```typescript
import {ExtensionInstance} from '../extension-instance.js'
```
With:
```typescript
import {ModuleInstance} from '../../app/module-instance.js'
```

Update the `preDeployValidation` callback parameter type.

#### 7.3 `models/extensions/specifications/ui_extension.test.ts`

Update import and test fixture types.

#### 7.4 `models/extensions/specifications/payments_app_extension.test.ts`

Update import and test fixture types.

#### 7.5 `models/extensions/specifications/function.test.ts`

Update import and test fixture types.

#### 7.6 `models/extensions/specifications/editor_extension_collection.test.ts`

Update import and test fixture types.

**How to verify:**
```bash
npx vitest run packages/app/src/cli/models/extensions/specifications/
npx vitest run packages/app/
```

**PR boundary:** Can be combined with Step 5 or Step 6.

---

### Step 8: Update the ExtensionSpecification interface

**File to modify:** `models/extensions/specification.ts`

The `ExtensionSpecification` interface has callback signatures that reference `ExtensionInstance`:

```typescript
preDeployValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
buildValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
contributeToSharedTypeFile?: (
  extension: ExtensionInstance<TConfiguration>,
  typeDefinitionsByFile: Map<string, Set<string>>,
) => Promise<void>
```

Change these to `ModuleInstance`:

```typescript
preDeployValidation?: (extension: ModuleInstance) => Promise<void>
buildValidation?: (extension: ModuleInstance) => Promise<void>
contributeToSharedTypeFile?: (
  extension: ModuleInstance,
  typeDefinitionsByFile: Map<string, Set<string>>,
) => Promise<void>
```

This change was listed in Step 5 for the import, but the type annotation changes happen here. Since `ModuleInstance` has compatibility aliases (`configuration`, `configurationPath`, `specification`), the old callback implementations continue to work.

**How to verify:**
```bash
npx tsc --noEmit --project packages/app/tsconfig.json
npx vitest run packages/app/
```

---

### Step 9: Remove compatibility aliases

Once all 65 files are migrated and tests pass, remove the compatibility layer from `ModuleInstance`.

**File to modify:** `models/app/module-instance.ts`

Remove:
1. The `get configuration()` / `set configuration()` aliases
2. The `get configurationPath()` / `set configurationPath()` aliases
3. The `get specification()` shim object
4. The `deployConfig()` alias (callers should use `encode()`)
5. The `bundleConfig()` method if `toDeployPayload()` is the new name

**Then grep for any remaining uses of the old names:**

```bash
# Check for 'instance.configuration' (should be 'instance.config')
grep -r "\.configuration[^P]" packages/app/src/cli/ --include="*.ts" | grep -v node_modules | grep -v "extension-instance.ts" | grep -v "\.configurationPath" | grep -v "app\.configuration" | grep -v "appConfiguration"

# Check for '.configurationPath' (should be '.configPath')
grep -r "\.configurationPath" packages/app/src/cli/ --include="*.ts" | grep -v node_modules | grep -v "extension-instance.ts"

# Check for '.specification.' (should be '.module.')
grep -r "\.specification\." packages/app/src/cli/ --include="*.ts" | grep -v node_modules | grep -v "extension-instance.ts" | grep -v "specification.ts"
```

For each remaining hit, update the callsite to use the new name. Then re-run:

```bash
npx tsc --noEmit --project packages/app/tsconfig.json
npx vitest run packages/app/
```

**PR boundary:** This can be its own small PR or combined with the previous step.

---

### Step 10: Run full CI

```bash
# Full test suite for the app package
npx vitest run packages/app/

# Full test suite for the entire monorepo
npx vitest run

# Type check
npx tsc --noEmit --project packages/app/tsconfig.json

# Lint
npx eslint packages/app/src/
```

Verify zero `ExtensionInstance` references in production code outside of:
- `models/extensions/extension-instance.ts` (the old class file, deleted in Phase 4)
- `models/extensions/specification.ts` if it still has the `ExtensionSpecification` interface with `ExtensionInstance` in callback types (deleted in Phase 4)

```bash
grep -r "ExtensionInstance" packages/app/src/cli/ --include="*.ts" --include="*.tsx" \
  | grep -v "extension-instance.ts" \
  | grep -v "node_modules" \
  | grep -v ".test." \
  | grep -v "test-data"
# Should return 0 results for production code
```

---

## Section 7: Verification

### 7.1 All existing tests pass

The primary verification is that the full test suite passes with zero regressions:

```bash
npx vitest run packages/app/
```

Expected: Same number of passing tests, same number of skipped tests, zero new failures.

### 7.2 ModuleInstance unit tests pass

```bash
npx vitest run packages/app/src/cli/models/app/module-instance.test.ts
```

The test file must cover:
- **Construction:** `handle`, `uid`, `devUUID`, `localIdentifier`, `idEnvironmentVariableName` are computed correctly for each UID strategy (`single`, `uuid`, `dynamic`)
- **Delegation:** Every method delegates to its `AppModule` (mock the module and verify calls)
- **Compatibility:** Deprecated aliases (`configuration`, `configurationPath`, `specification`) work correctly
- **Encode:** Calls `module.encode()` and performs post-encode contract validation
- **Build:** Dispatches to the correct build function based on `module.buildConfig.mode`
- **Feature detection:** `isPreviewable`, `isThemeExtension`, `isFunctionExtension`, etc. reflect `module.appModuleFeatures()`
- **isAppConfigExtension:** Returns `true` when `module.tomlKeys` is defined, `false` otherwise

### 7.3 Loading function tests pass

```bash
npx vitest run packages/app/src/cli/models/app/loading.test.ts
npx vitest run packages/app/src/cli/models/app/toml-file.test.ts
npx vitest run packages/app/src/cli/models/app/project-layout.test.ts
```

### 7.4 No references to ExtensionInstance in production code

```bash
# This command should return ONLY:
# - extension-instance.ts itself
# - Any re-export aliases added for backward compat
grep -rn "ExtensionInstance" packages/app/src/cli/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v node_modules \
  | grep -v ".test." \
  | grep -v "test-data" \
  | grep -v "extension-instance.ts"
```

Expected: Zero lines for production code. The old `extension-instance.ts` file remains on disk (deleted in Phase 4) but nothing imports from it.

### 7.5 Parity verification

For critical module types, write parity tests that prove `ModuleInstance.encode()` produces identical output to what `ExtensionInstance.deployConfig()` produced:

```typescript
// In module-instance.test.ts or a dedicated parity test file:
describe('encode parity with old deployConfig', () => {
  test('branding module', async () => {
    const instance = new ModuleInstance({
      module: brandingModule,
      config: {name: 'My App', handle: 'my-app'},
      directory: '/tmp', configPath: '/tmp/shopify.app.toml',
    })
    const encoded = await instance.encode({apiKey: 'key', appConfiguration: {...}})
    expect(encoded).toEqual({name: 'My App', app_handle: 'my-app'})
  })

  test('function module', async () => { /* ... */ })
  test('ui_extension module', async () => { /* ... */ })
  test('webhook_subscription module', async () => { /* ... */ })
  // One test per critical module type
})
```

---

## Section 8: Rollback Strategies

Each PR has an explicit rollback plan. The compatibility aliases in `ModuleInstance` are the key safety mechanism -- they ensure that partially-migrated states are valid at runtime.

### PR 1 (Step 1 -- Create new files)

- **Rollback:** Delete the new files. No existing code was modified.
- **Partial rollback safe:** Yes -- fully additive.
- **Production impact:** None -- no behavioral changes. The new files are not imported by any existing code.

### PR 2 (Step 3 -- Test data factory)

- **Rollback:** Revert the factory file changes. All test files use these factories, so reverting the factory reverts the behavior.
- **Partial rollback safe:** No -- if PR 2 is merged, the factories produce `ModuleInstance`. PR 3+ depends on this.
- **Production impact:** None -- test-only changes. No production code paths are altered.
- **Emergency:** If CI is red after merge, revert the entire PR. The old factories produce `ExtensionInstance` which is still the production type at this point.

### PR 3 (Steps 4, 6 -- App class + loader)

- **Rollback:** Revert the App class and loader changes. The factories (PR 2) still produce `ModuleInstance` but the compatibility aliases make them work with old code that expects `ExtensionInstance`.
- **Partial rollback safe:** Partial is possible IF you also revert the factory back (PR 2 revert). Reverting PR 3 alone is safe because `ModuleInstance` compatibility aliases let the test factories work with either the old or new App class.
- **Production impact:** This is the first PR with production behavior changes. The loader now produces `ModuleInstance` instead of `ExtensionInstance`. If production issues occur after merge:
  1. Immediately revert PR 3.
  2. If issues persist, also revert PR 2.
  3. The compatibility aliases in `ModuleInstance` ensure old code paths work -- the `configuration`, `configurationPath`, and `specification` getters all return the same values the old code expected.

### PR 4 (Steps 5, 7, 8 -- Batch type replacements)

- **Rollback:** Revert the import/type changes. Since PR 3 already produces `ModuleInstance`, the compatibility aliases make both naming conventions work.
- **Partial rollback safe:** Yes -- individual files can be reverted independently. Each file's change is a self-contained import + type rename. Reverting one file does not affect others because both `ExtensionInstance` (via import from extension-instance.ts) and `ModuleInstance` refer to the same runtime objects after PR 3.
- **Production impact:** None -- type-only changes (same runtime objects). The import paths change but the runtime behavior is identical.

### PR 5 (Step 9 -- Remove compatibility aliases)

- **Rollback:** Re-add the compatibility aliases to `ModuleInstance`.
- **Partial rollback safe:** No -- removing aliases is all-or-nothing. If even one callsite still uses `instance.configuration` instead of `instance.config`, it will fail at runtime.
- **Production impact:** None IF no external code references old names.
- **Pre-merge check:** Grep the entire monorepo for remaining uses of the old names:
  ```bash
  # Check for '.configuration' on instances (should be '.config')
  grep -r "\.configuration[^P]" packages/app/src/cli/ --include="*.ts" \
    | grep -v node_modules | grep -v "extension-instance.ts" \
    | grep -v "\.configurationPath" | grep -v "app\.configuration" | grep -v "appConfiguration"

  # Check for '.configurationPath' (should be '.configPath')
  grep -r "\.configurationPath" packages/app/src/cli/ --include="*.ts" \
    | grep -v node_modules | grep -v "extension-instance.ts"

  # Check for '.specification.' (should be '.module.')
  grep -r "\.specification\." packages/app/src/cli/ --include="*.ts" \
    | grep -v node_modules | grep -v "extension-instance.ts" | grep -v "specification.ts"
  ```
  All three greps must return zero results before merging this PR.

---

## Summary: PR Sequence

| PR | Steps | Risk | Description |
|----|-------|------|-------------|
| **PR 1** | Step 1 | Low | Create all new files (additive only). Extend AppModule interface. |
| **PR 2** | Step 3 | **High** | Update test data factory to produce ModuleInstance. Run full suite. |
| **PR 3** | Steps 4, 6 | Medium | Update App class and Category B files (loader, app.test). |
| **PR 4** | Steps 5, 7, 8 | Low | Batch type-import replacements (52+ files) + spec file updates. Mechanical. |
| **PR 5** | Step 9 | Low | Remove compatibility aliases. Clean up. |

Each PR must pass the full test suite before merging. If any PR introduces failures, fix them before proceeding to the next PR. The compatibility aliases ensure that partially-migrated states are valid.

---

## Appendix A: RemoteModuleMetadata interface

**File to create:** `packages/app/src/cli/models/app/remote-module-metadata.ts`

```typescript
/**
 * Server-provided metadata about a module type.
 * Fetched via the specifications API and attached to AppModule.remote during loading.
 * This is per-type, not per-instance.
 */
export interface RemoteModuleMetadata {
  /** JSON Schema string for post-encode contract validation */
  contractSchema?: string
  /** Maximum number of instances of this type per app */
  registrationLimit: number
  /** GraphQL type name used by the API */
  graphQLType: string
  /** Identifier used by external systems */
  externalIdentifier: string
  /** Human-readable name shown in UIs */
  externalName: string
  /** Identifier used in Partners web UI URLs */
  partnersWebIdentifier: string
  /** Surface where the extension renders (e.g., 'admin', 'checkout', 'all') */
  surface: string
  /** Alternative identifiers for backward compatibility */
  additionalIdentifiers: string[]
  /** npm dependency to add when generating */
  dependency?: string
}
```

---

## Appendix B: AppModule Extensions Required for Phase 3

The following properties and methods must be added to the `AppModule` base class in `models/app/app-module.ts` during Step 1. Each Phase 2 subclass must override the relevant methods.

### Properties to add to AppModule base class

```typescript
// On the base class (with defaults):
remote?: RemoteModuleMetadata                    // undefined until enriched
readonly buildConfig: BuildConfig = {mode: 'none'}
```

### Methods to add to AppModule base class (with defaults)

```typescript
computeHandle(config: TToml): string        // default: strategy-based (see Section 2)
computeUid(config: TToml): string           // default: strategy-based (see Section 2)
appModuleFeatures(config?: TToml): ExtensionFeature[]  // default: []
```

### Optional methods (undefined on base class, overridden by subclasses that need them)

```typescript
validate?(instance: ModuleInstance): Promise<Result<unknown, string>>
preDeployValidation?(instance: ModuleInstance): Promise<void>
buildValidation?(instance: ModuleInstance): Promise<void>
build?(instance: ModuleInstance, options: ExtensionBuildOptions): Promise<void>
patchForDev?(config: TToml, urls: ApplicationURLs): void
devMessages?(config: TToml): Promise<string[]>
getBundleExtensionStdinContent?(instance: ModuleInstance): {main: string; assets?: Asset[]}
hasExtensionPointTarget?(config: TToml, target: string): boolean
devSessionDefaultWatchPaths?(instance: ModuleInstance): string[]
contributeToSharedTypeFile?(instance: ModuleInstance, map: Map<string, Set<string>>): Promise<void>
copyStaticAssets?(instance: ModuleInstance, outputPath: string): Promise<void>
```

### Which Phase 2 modules need which methods

| Module | buildConfig | build | validate | patchForDev | devMessages | Other |
|--------|-------------|-------|----------|-------------|-------------|-------|
| BrandingModule | none | - | - | - | - | - |
| AppAccessModule | none | - | - | patchForDev | devMessages | - |
| WebhooksModule | none | - | - | - | - | - |
| WebhookSubscriptionModule | none | - | - | - | - | - |
| EventsModule | none | - | - | - | - | - |
| PrivacyComplianceModule | none | - | - | - | - | - |
| AppProxyModule | none | - | - | patchForDev | - | - |
| PointOfSaleModule | none | - | - | - | - | - |
| AppHomeModule | none | - | - | patchForDev | - | - |
| FunctionModule | function | build | - | - | - | - |
| UIExtensionModule | ui | build | - | - | - | getBundleExtensionStdinContent, contributeToSharedTypeFile, copyStaticAssets, hasExtensionPointTarget, devSessionDefaultWatchPaths |
| ThemeModule | theme | build | preDeployValidation | - | - | - |
| CheckoutPostPurchaseModule | ui | build | - | - | - | - |
| PaymentsModule | copy_files | build | - | - | - | - |
| FlowActionModule | copy_files | build | - | - | - | - |
| TaxCalculationModule | tax_calculation | build | - | - | - | - |
| EditorExtensionCollectionModule | none | - | - | - | - | - |

This table should be used to verify that every Phase 2 module has the correct capability methods implemented before Phase 3 begins.
