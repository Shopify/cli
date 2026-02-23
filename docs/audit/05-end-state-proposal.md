# End State Architecture

## The System Today

The CLI manages two kinds of TOML files: the shared `shopify.app.toml` (containing app identity + config module sections like `[access_scopes]`, `[webhooks]`, `[pos]`) and individual `.extension.toml` files (one per extension, in `extensions/` directories).

The data flow from TOML to server passes through 6 transformation points:

1. **Zod `.transform()`** during parsing — normalizes values, but also restructures data (e.g., `mergeAllWebhooks` deduplicates/sorts subscriptions)
2. **`patchWithAppDevURLs()`** in dev mode — mutates config with tunnel URLs
3. **`getBundleExtensionStdinContent()`** during build — generates esbuild input (UI extensions only)
4. **`configWithoutFirstClassFields()`** pre-deploy — strips metadata (`type`, `handle`, `uid`, `path`)
5. **`deployConfig()` / `transformLocalToRemote()`** during deploy — the main reshape (field renames, nesting changes, file I/O)
6. **`bundleConfig()`** — wraps + JSON.stringify for API submission

Three god abstractions manage this: `ExtensionSpecification` (30+ properties mixing type metadata, validation, transforms, build config, dev mode), `ExtensionInstance` (400+ lines mixing config management, build, deploy, dev, display), and `AppLoader` (900+ lines mixing file discovery, TOML parsing, schema validation, instance creation, error handling).

## Problems

**1. Silent data loss (the access_scopes incident).** Contract validation runs pre-transform on TOML-shaped data via `unifiedConfigurationParserFactory`. The contract defines the API shape (post-transform field names). In `strip` mode, TOML fields that don't match contract fields are silently removed. For `app_access`, this produced `{}` — the CLI deployed empty config, wiping the app's access scopes. Any of the 9 config modules with transforms could hit this.

**2. Scattered, inconsistent transforms.** Config modules use two mechanisms: `TransformationConfig` (declarative path maps) and `CustomTransformationConfig` (arbitrary forward/reverse functions), resolved through separate code paths in `resolveAppConfigTransform()`. Non-config extensions use a third mechanism: `spec.deployConfig()`. A fourth mechanism hides in Zod schemas (`mergeAllWebhooks`). Forward and reverse transforms are defined separately and can diverge.

**3. Implicit extraction with base field leaking.** Every config module's Zod schema extends `BaseSchemaWithoutHandle`, which includes `name`, `type`, `description`, etc. When parsing the full app TOML, every module extracts these base fields from other modules — creating phantom instances (e.g., an `events` instance with just `{name: 'my-app'}` when no `[events]` section exists). Webhook subscription splitting is hardcoded separately in the loader.

**4. God classes.** `ExtensionSpecification` defines 30+ properties mixing concerns. `ExtensionInstance` has 400+ lines with conditional branches everywhere (`isAppConfigExtension`, `isUUIDStrategyExtension`). `AppLoader` has 900+ lines handling three different loading paths. Adding behavior or fixing bugs requires understanding the full god class.

**5. False config/extension dichotomy.** The CLI has separate code paths for config modules (`createConfigExtensionInstances` + `createWebhookSubscriptionInstances`) vs extensions (`createExtensionInstances`). `CONFIG_EXTENSION_IDS` is a hardcoded array. `isAppConfigExtension` gates behavior throughout the codebase. But the server treats them all the same — app modules with contracts.

**6. Contract migration blocked.** Adding a contract to any config module with transforms is dangerous (Problem 1). There's no clear path from the current state (TOML ≠ contract format, transforms bridge the gap) to the target state (TOML = contract format, no transforms needed). The validation, extraction, and transformation systems are too entangled to change independently.

**7. Monolithic merged schema.** `contributeToAppConfigurationSchema` dynamically merges each spec's Zod schema into a single app-level schema via `getAppVersionedSchema()`. This merged schema mixes validation with extraction. It includes base fields that leak across modules. It requires every spec to have a local Zod schema — contradicting the contract vision where the server is the source of truth.

**8. Domain entanglement.** `AppSchema` mixes app identity (`client_id`) with project layout (`extension_directories`) with CLI preferences (`build`). `ExtensionSpecification` mixes module behavior with platform metadata. `ExtensionInstance` mixes everything. No abstraction owns a single domain.

## Three Layers

The system has three layers. Data flows between them bidirectionally:

```
┌─────────────────────────────────────────────────────────────────┐
│  API Layer (Server)                                             │
│  Defines module types. Owns contracts. Validates. Stores.       │
│  Publishes type definitions via specifications API.             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         Specifications API    │    Deploy/Dev Session API
         (type definitions)    │    (config payloads)
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│  Client Layer (CLI)                                             │
│  Implements encoding, building, dev mode.                       │
│  Bridges between TOML and API.                                  │
│  Validates against contracts before sending.                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         Extract / Write       │    (TOML files on disk)
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│  User Interface Layer (TOML)                                    │
│  What developers write and maintain.                            │
│  shopify.app.toml + *.extension.toml                            │
└─────────────────────────────────────────────────────────────────┘
```

**Deploy flow (UI → Client → API):** TOML → extract → encode → validate against contract → send to server

**Link flow (API → Client → UI):** Server config → decode → write to TOML

**Dev flow (UI → Client → API + local):** TOML → extract → patch URLs → encode → dev session + local dev server

A module type is defined **jointly** by the API and Client layers:
- **API layer contributes:** contract schema, registration limits, feature flags, graphQL type, external name
- **Client layer contributes:** extraction rules, encoding logic, build process, dev mode behavior

These combine into one `AppModule`. The module isn't fully defined until both layers contribute. The TOML layer is the input/output — not part of the module definition.

## Design Principles

1. **One module type.** The server doesn't distinguish between "config modules" and "extensions." They're all app modules with contracts. The CLI shouldn't either.

2. **Capabilities, not categories.** A module that builds overrides `build()`. A module that patches dev URLs overrides `patchForDev()`. A module that reads from shared app.toml sets `tomlKeys`. These are capabilities — not reasons for intermediate abstract classes.

3. **Contracts are the source of truth.** Validation happens post-encode against the contract. No Zod-based module schema merging. The CLI encodes and sends; the contract validates.

4. **The module is the complete type definition.** An AppModule combines what the client knows (how to encode, build, dev) with what the server provides (contract, limits, features). Remote metadata is part of the module, not something bolted onto instances.

5. **Each abstraction owns one concern.** TOML files own file I/O. AppModule owns type definition (client + server). ModuleInstance owns per-occurrence data. ProjectLayout owns workspace structure.

## Domains

| Domain | What it owns | Abstraction |
|--------|-------------|-------------|
| **Module Type Definition** | How a module works (encode, build, dev) + what the server expects (contract, limits) | `AppModule` |
| **Module Occurrence** | A specific config with identity (handle, uid) from a specific file | `ModuleInstance` |
| **App Configuration Files** | TOML file I/O, extraction of module data from files | `AppTomlFile`, `ExtensionTomlFile` |
| **Project Layout** | Extension directories, web directories, build preferences | `ProjectLayout` |

Today these are entangled: `ExtensionSpecification` mixes client behavior with server metadata. `ExtensionInstance` mixes type definition with per-occurrence data. `AppSchema` mixes app identity with project layout.

## Abstractions

### `TomlFile` — a parsed TOML file on disk

No domain logic. Just I/O.

```typescript
class TomlFile {
  readonly content: Record<string, unknown>
  readonly path: string
  readonly directory: string

  static async load(path: string): Promise<TomlFile>
  async write(content: Record<string, unknown>): Promise<void>
}
```

### `AppTomlFile` — the shared app configuration

Domain: app module configuration. Owns the module sections and app identity. Does NOT own project layout (`extension_directories`, `build`, `web_directories`).

```typescript
class AppTomlFile extends TomlFile {
  /** App identity — required, validated on load */
  readonly clientId: string

  /** Registry of modules that can extract from this file */
  private modules: AppModule[]

  constructor(toml: TomlFile, modules: AppModule[]) {
    // Validate client_id is present
    // Store modules registry
  }

  /** Extract all modules that have data in this TOML */
  extractAll(): ModuleInstance[] {
    const instances: ModuleInstance[] = []
    for (const module of this.modules) {
      const extracted = module.extract(this.content)
      if (!extracted) continue

      if (Array.isArray(extracted)) {
        // Dynamic modules (e.g., webhook subscriptions) return multiple items
        for (const item of extracted) {
          instances.push(new ModuleInstance(module, item, this.directory, this.path))
        }
      } else {
        instances.push(new ModuleInstance(module, extracted, this.directory, this.path))
      }
    }
    return instances
  }

  /** Write server state back to TOML module sections */
  applyServerState(serverModules: ServerModuleData[]): void {
    for (const serverModule of serverModules) {
      const module = this.modules.find(m => m.identifier === serverModule.identifier)
      if (!module?.decode) continue
      const tomlSlice = module.decode(serverModule.config)
      Object.assign(this.content, tomlSlice)
    }
  }
}
```

### `ExtensionTomlFile` — an individual extension's configuration

Domain: one extension type's configuration. The whole file is the module's data.

```typescript
class ExtensionTomlFile extends TomlFile {
  readonly module: AppModule

  constructor(toml: TomlFile, module: AppModule) {
    // Match module by type field in TOML
  }

  extractAll(): ModuleInstance[] {
    const extracted = this.module.extract(this.content)
    if (!extracted) return []

    // Handle unified format (multiple extensions in one file)
    if (Array.isArray(extracted)) {
      return extracted.map(item =>
        new ModuleInstance(this.module, item, this.directory, this.path)
      )
    }
    return [new ModuleInstance(this.module, extracted, this.directory, this.path)]
  }
}
```

### `ProjectLayout` — how the project is organized on disk

Domain: workspace structure. Read from the app TOML but not owned by `AppTomlFile`.

```typescript
interface ProjectLayout {
  extensionDirectories: string[]
  webDirectories: string[]
  build: {
    automaticallyUpdateUrlsOnDev?: boolean
    devStoreUrl?: string
    includeConfigOnDeploy?: boolean
  }
}

function readProjectLayout(tomlContent: Record<string, unknown>): ProjectLayout {
  return {
    extensionDirectories: (tomlContent.extension_directories as string[]) ?? ['extensions'],
    webDirectories: (tomlContent.web_directories as string[]) ?? [],
    build: (tomlContent.build as ProjectLayout['build']) ?? {},
  }
}
```

### `AppModule` — what a module IS

Domain: module behavior. One base class. Concrete modules extend it directly — typically max depth of 2 (base class + extended class).

```typescript
class AppModule<TToml = unknown, TContract = unknown> {
  readonly identifier: string
  readonly uidStrategy: 'single' | 'dynamic' | 'uuid'

  // --- Extraction ---

  /** Keys this module reads from app.toml. Absent = owns its whole file. */
  readonly tomlKeys?: string[]

  /** Extract this module's data from TOML content. */
  extract(content: Record<string, unknown>): TToml | TToml[] | undefined {
    if (this.tomlKeys) return extractByKeys(this.tomlKeys, content) as TToml | undefined
    return content as TToml
  }

  // --- Data flow ---

  /** Encode to contract format. Override for transforms, file I/O, computed fields. */
  async encode(toml: TToml, context: EncodeContext): Promise<TContract> {
    return toml as unknown as TContract  // default: passthrough
  }

  /** Decode contract data back to TOML. Override for reverse transforms. */
  decode(contract: TContract): TToml {
    return contract as unknown as TToml  // default: passthrough
  }

  // --- Identity ---

  computeHandle(config: TToml): string { return this.identifier }
  computeUid(config: TToml): string { return this.identifier }

  // --- Remote metadata (enriched from server after spec fetch) ---

  /** Server-provided type definition. Attached during loading, before instances are created. */
  remote?: RemoteModuleMetadata

  // --- Build (optional capability) ---

  async build?(instance: ModuleInstance, options: BuildOptions): Promise<void>

  // --- Dev (optional capabilities) ---

  patchForDev?(config: TToml, urls: ApplicationURLs): void
  devMessages?(config: TToml): Promise<string[]>
  getDevProcess?(instance: ModuleInstance, options: DevOptions): DevProcess
}

/**
 * What the server tells the CLI about this module type.
 * Fetched via the specifications API and attached to the AppModule at load time.
 */
interface RemoteModuleMetadata {
  contractSchema?: SchemaObject   // JSON Schema for post-encode validation
  registrationLimit: number
  graphQLType: string
  externalIdentifier: string
  externalName: string
  // feature flags, surface, etc.
}

interface EncodeContext {
  appConfiguration: AppConfigurationWithoutPath
  directory: string
  apiKey: string
}
```

### `ModuleInstance` — a specific occurrence with config

Domain: bridges module definition with concrete data. Delegates behavior to its module.

**Why two classes instead of one:** `AppModule` is a type definition — one `WebhookSubscriptionModule` knows how to encode any webhook subscription. But an app might have 10 subscriptions, each with different config, handle, and UID. `ModuleInstance` holds the per-occurrence data (config, identity) while sharing the module's type definition. For single-UID modules this is a 1:1 relationship, but for dynamic modules it's 1:N — one module definition, many instances.

```typescript
class ModuleInstance<TToml = unknown> {
  readonly module: AppModule<TToml>
  readonly config: TToml
  readonly handle: string
  readonly uid: string
  readonly directory: string
  readonly configPath: string

  constructor(module: AppModule<TToml>, config: TToml, directory: string, configPath: string) {
    this.module = module
    this.config = config
    this.handle = module.computeHandle(config)
    this.uid = module.computeUid(config)
    this.directory = directory
    this.configPath = configPath
  }

  get identifier() { return this.module.identifier }
  get uidStrategy() { return this.module.uidStrategy }

  async encode(context: EncodeContext): Promise<unknown> {
    return this.module.encode(this.config, context)
  }

  /** Validate encoded output against the module type's contract */
  async validateEncoded(encoded: unknown): Promise<ValidationError[]> {
    if (!this.module.remote?.contractSchema) return []
    const result = jsonSchemaValidate(encoded, this.module.remote.contractSchema, 'fail')
    return result.state === 'error' ? result.errors : []
  }

  async toDeployPayload(context: EncodeContext, identifiers: Identifiers): Promise<BundleConfig | undefined> {
    const encoded = await this.encode(context)
    if (!encoded || Object.keys(encoded as object).length === 0) return undefined

    const errors = await this.validateEncoded(encoded)
    if (errors.length > 0) {
      outputDebug(`Contract errors for ${this.handle}: ${JSON.stringify(errors)}`)
    }

    return {
      config: JSON.stringify(encoded),
      handle: this.handle,
      uid: this.uid,
      context: this.module.tomlKeys ? '' : this.handle,
      uuid: this.uidStrategy === 'uuid' ? identifiers.extensions[this.handle] : undefined,
      specificationIdentifier: this.module.remote?.graphQLType ?? this.identifier,
    }
  }
}
```

Note: `ModuleInstance` has no `remote` field. Remote metadata is on `this.module.remote` — it's per-type, not per-occurrence. The contract schema, registration limits, and API types are the same for every instance of the same module type.
```

### `App` — the loaded application

Holds everything together. Not a god class — just a container.

```typescript
class App {
  readonly toml: AppTomlFile
  readonly instances: ModuleInstance[]
  readonly layout: ProjectLayout

  get configuration(): AppConfigurationWithoutPath {
    return this.toml.content as AppConfigurationWithoutPath
  }
}
```

## Module Registry

```typescript
const ALL_MODULES: AppModule[] = [
  // Modules in shopify.app.toml (have tomlKeys)
  new BrandingModule(),
  new AppAccessModule(),
  new WebhooksModule(),
  new WebhookSubscriptionModule(),
  new EventsModule(),
  new PrivacyComplianceModule(),
  new AppProxyModule(),
  new PointOfSaleModule(),
  new AppHomeModule(),

  // Modules in .extension.toml files (no tomlKeys)
  new FunctionModule(),
  new UIExtensionModule(),
  new ThemeModule(),
  new PaymentsModule(),
  new FlowActionModule(),
  new FlowTriggerModule(),
  new FlowTemplateModule(),
  new CheckoutPostPurchaseModule(),
  new CheckoutUIModule(),
  new WebPixelModule(),
  new TaxCalculationModule(),
  new PosUIModule(),
  new ProductSubscriptionModule(),
  new EditorExtensionCollectionModule(),

  // Contract-only modules (base class, passthrough defaults)
  new AppModule({identifier: 'data', uidStrategy: 'single', tomlKeys: []}),
  new AppModule({identifier: 'channel_config', uidStrategy: 'single'}),
]

// Derived for loading — not a category, just a filter
const appTomlModules = ALL_MODULES.filter(m => m.tomlKeys !== undefined)
const extensionModules = ALL_MODULES.filter(m => m.tomlKeys === undefined)
```

## Loading

Clear domain boundaries at each step.

```typescript
async function loadApp(directory: string): Promise<App> {
  // --- File I/O ---
  const rawToml = await TomlFile.load(joinPath(directory, 'shopify.app.toml'))

  // --- Project Layout (workspace concern) ---
  const layout = readProjectLayout(rawToml.content)

  // --- Enrich modules with server metadata (complete the type definitions) ---
  const remoteSpecs = await fetchRemoteSpecs(rawToml.content.client_id as string)
  enrichModulesWithRemoteMetadata(ALL_MODULES, remoteSpecs)
  // After this, every AppModule's .remote is populated with contract, limits, etc.
  // Modules not found in remote specs keep remote = undefined (local-only, no contract yet).

  // --- Create contract-only modules from server-defined types ---
  const dynamicModules = createModulesFromRemoteSpecs(remoteSpecs, ALL_MODULES)
  const allModules = [...ALL_MODULES, ...dynamicModules]

  // --- Extract instances from TOML files ---
  const appTomlModules = allModules.filter(m => m.tomlKeys !== undefined)
  const appToml = new AppTomlFile(rawToml, appTomlModules)
  const configInstances = appToml.extractAll()

  const extensionFiles = await discoverExtensionFiles(directory, layout.extensionDirectories)
  const extensionInstances = extensionFiles.flatMap(f => f.extractAll())

  return new App(appToml, [...configInstances, ...extensionInstances], layout)
}

/** Attach server metadata to module type definitions */
function enrichModulesWithRemoteMetadata(modules: AppModule[], remoteSpecs: RemoteSpec[]): void {
  for (const module of modules) {
    const remote = remoteSpecs.find(r => r.identifier === module.identifier)
    if (remote) {
      module.remote = {
        contractSchema: remote.validationSchema?.jsonSchema,
        registrationLimit: remote.options.registrationLimit,
        graphQLType: remote.graphQLType ?? remote.identifier,
        externalIdentifier: remote.externalIdentifier,
        externalName: remote.externalName,
      }
    }
  }
}

/** Create AppModule instances for server-defined types with no local implementation */
function createModulesFromRemoteSpecs(remoteSpecs: RemoteSpec[], existingModules: AppModule[]): AppModule[] {
  const existingIds = new Set(existingModules.map(m => m.identifier))
  return remoteSpecs
    .filter(r => !existingIds.has(r.identifier) && r.validationSchema?.jsonSchema)
    .map(r => {
      const module = new AppModule({
        identifier: r.identifier,
        uidStrategy: r.options.uidIsClientProvided ? 'uuid' : 'single',
        tomlKeys: [],  // contract-only — keys derived from contract at validation time
      })
      module.remote = { /* ... from r ... */ }
      return module
    })
}
```

## Deploy

```typescript
async function deploy(app: App, options: DeployOptions): Promise<void> {
  // Build modules that need it
  for (const instance of app.instances) {
    if (instance.module.build) {
      await instance.module.build(instance, options.buildOptions)
    }
  }

  // Encode + validate + bundle
  const context: EncodeContext = {
    appConfiguration: app.configuration,
    directory: app.toml.directory,
    apiKey: options.apiKey,
  }
  const payloads = await Promise.all(
    app.instances.map(i => i.toDeployPayload(context, options.identifiers))
  )

  await uploadBundle(payloads.filter(Boolean), options)
}
```

## Dev

```typescript
async function dev(app: App, options: DevOptions): Promise<void> {
  // Patch and message — any module can do this
  for (const instance of app.instances) {
    instance.module.patchForDev?.(instance.config, options.urls)
    const messages = await instance.module.devMessages?.(instance.config)
    messages?.forEach(m => outputInfo(m))
  }

  // Collect dev processes — any module can provide one
  const devProcesses = app.instances
    .map(i => i.module.getDevProcess?.(i, options))
    .filter(Boolean)

  await renderConcurrent({
    processes: [createDevSessionProcess(app, options), ...devProcesses],
  })
}
```

## Concrete Module Examples

### Branding (shared app.toml, simple rename)

```typescript
class BrandingModule extends AppModule<BrandingToml, BrandingContract> {
  identifier = 'branding'
  uidStrategy = 'single' as const
  tomlKeys = ['name', 'handle']

  async encode(toml: BrandingToml) {
    return { name: toml.name, app_handle: toml.handle }
  }

  decode(contract: BrandingContract) {
    return { name: contract.name, handle: contract.app_handle }
  }
}
```

### Function (own file, async file I/O, builds)

```typescript
class FunctionModule extends AppModule<FunctionToml, FunctionContract> {
  identifier = 'function'
  uidStrategy = 'uuid' as const

  async encode(toml: FunctionToml, context: EncodeContext) {
    const inputQuery = toml.targeting?.[0]?.input_query
      ? await readFile(joinPath(context.directory, toml.targeting[0].input_query))
      : undefined
    const localization = await loadLocalesConfig(context.directory, this.identifier)

    return {
      title: toml.name,
      api_type: toml.type,
      api_version: toml.api_version,
      input_query: inputQuery,
      module_id: nonRandomUUID(JSON.stringify(toml)),
      localization,
    }
  }

  computeUid(config: FunctionToml) {
    return nonRandomUUID(JSON.stringify(config))
  }

  async build(instance: ModuleInstance, options: BuildOptions) {
    await buildFunctionExtension(instance, options)
  }
}
```

### UI Extension (own file, builds, dev server)

```typescript
class UIExtensionModule extends AppModule<UIExtensionToml, UIExtensionContract> {
  identifier = 'ui_extension'
  uidStrategy = 'uuid' as const

  async encode(toml: UIExtensionToml, context: EncodeContext) {
    const localization = await loadLocalesConfig(context.directory, this.identifier)
    return {
      extension_points: toml.extension_points.map(ep => ({
        ...ep,
        assets: {main: {filepath: `dist/${ep.module}`}},
      })),
      localization,
    }
  }

  async build(instance: ModuleInstance, options: BuildOptions) {
    await buildUIExtension(instance, options)
  }

  getDevProcess(instance: ModuleInstance, options: DevOptions): DevProcess {
    return {
      prefix: instance.handle,
      action: async (stdout, stderr, signal) => {
        await startExtensionDevServer(instance, options, {stdout, stderr, signal})
      },
    }
  }
}
```

### App Access (shared app.toml, dev URL patching)

```typescript
class AppAccessModule extends AppModule<AppAccessToml, AppAccessContract> {
  identifier = 'app_access'
  uidStrategy = 'single' as const
  tomlKeys = ['access', 'access_scopes', 'auth']

  async encode(toml: AppAccessToml) {
    return {
      access: toml.access,
      scopes: toml.access_scopes?.scopes,
      required_scopes: toml.access_scopes?.required_scopes,
      optional_scopes: toml.access_scopes?.optional_scopes,
      use_legacy_install_flow: toml.access_scopes?.use_legacy_install_flow,
      redirect_url_allowlist: toml.auth?.redirect_urls,
    }
  }

  patchForDev(config: AppAccessToml, urls: ApplicationURLs) {
    if (urls.redirectUrlWhitelist) {
      config.auth = {redirect_urls: urls.redirectUrlWhitelist}
    }
  }

  async devMessages(config: AppAccessToml) {
    const scopes = config.access_scopes?.scopes
    if (scopes) return [`Access scopes auto-granted: ${scopes}`]
    return []
  }
}
```

### Contract-only (base class instance, passthrough)

```typescript
// Registered locally with minimal info. The server enriches with contract + metadata at load time.
const dataModule = new AppModule({
  identifier: 'data',
  uidStrategy: 'single',
  tomlKeys: [],
})
// After enrichModulesWithRemoteMetadata():
// dataModule.remote = { contractSchema: {...}, registrationLimit: 1, graphQLType: 'data', ... }
// encode() is passthrough (base class default). Contract validates the TOML data directly.
```

## No Merged App Schema

`AppTomlFile` validates only app identity on load:

```typescript
class AppTomlFile extends TomlFile {
  constructor(toml: TomlFile, modules: AppModule[]) {
    const clientId = toml.content.client_id
    if (typeof clientId !== 'string') {
      throw new AbortError('Missing or invalid client_id in shopify.app.toml')
    }
    this.clientId = clientId
    this.modules = modules
  }
}
```

No `contributeToAppConfigurationSchema`. No `getAppVersionedSchema`. No dynamic Zod schema merging. Module fields pass through unvalidated at load time — the contract validates them post-encode.

## How This Solves the Problems

**Problem 1 (silent data loss):** Contract validation moves post-encode. `AppModule.encode()` produces contract-shaped data, then `ModuleInstance.validateEncoded()` validates it against the contract with `fail` mode — no strip. The shape mismatch that caused the incident is impossible by construction.

**Problem 2 (scattered transforms):** One mechanism: `AppModule.encode()` (async). Co-located with `decode()` on the same class. No declarative path maps, no custom config types, no resolution dispatch. A branding module and a function module use the same interface — they just override different methods.

**Problem 3 (implicit extraction):** `extractByKeys()` picks only declared `tomlKeys`. No base field leaking. Webhook splitting lives in `WebhookSubscriptionModule.extract()`, not hardcoded in the loader. Modules are only instantiated when their keys exist in the TOML.

**Problem 4 (god classes):** `AppModule` is one class with optional capabilities — not 30+ required properties. `ModuleInstance` is a lightweight data carrier that delegates to its module. Loading is two functions (`loadApp` orchestrates, `AppTomlFile.extractAll()` and `ExtensionTomlFile.extractAll()` do extraction). No 900-line loader class.

**Problem 5 (config/extension dichotomy):** One `AppModule` class for all module types. One flat registry. Whether a module reads from `app.toml` or owns its own file is just whether `tomlKeys` is set — a data property, not a type hierarchy. No `CONFIG_EXTENSION_IDS`, no `isAppConfigExtension`.

**Problem 6 (contract migration blocked):** Contracts validate post-encode (the right data at the right boundary). When TOML format converges with contract format for a module, its `encode()` becomes a passthrough and can be deleted. Each module converges independently — no system-wide migration needed.

**Problem 7 (monolithic merged schema):** Eliminated. `AppTomlFile` validates only `client_id`. Module validation is the contract's job post-encode. No `contributeToAppConfigurationSchema`, no `getAppVersionedSchema`, no dynamic schema merging.

**Problem 8 (domain entanglement):** Clear ownership per abstraction. `AppModule` owns the complete module type definition — both client behavior (encode, build, dev) and server metadata (contract, limits, features). `ModuleInstance` owns per-occurrence data only (config, identity). `AppTomlFile`/`ExtensionTomlFile` own file I/O. `ProjectLayout` owns workspace structure. Each abstraction has one job.

## Migration Path

| Phase | What | Result |
|-------|------|--------|
| **1** | Introduce AppModule class. Implement 9 config modules as AppModule subclasses. Wire into loader, deployConfig, select-app. Fix the contract validation category error. | Config modules on new system. Old system handles everything else. |
| **2** | Implement all non-config extension types as AppModule subclasses. One independent PR per type. Each module switches from old spec to AppModule by being added to the registry. | All modules have AppModule implementations. `deployConfig()` uses `encode()` for every module. |
| **3** | Replace ExtensionInstance with ModuleInstance. Replace AppLoader with loading functions. Introduce TomlFile hierarchy, ProjectLayout. | Clean architecture. No god classes. No bridge/adapter needed because all modules already have real AppModules. |
| **4** | Delete old infrastructure: ExtensionSpecification, ExtensionInstance, AppLoader, transform helpers, CONFIG_EXTENSION_IDS, contributeToAppConfigurationSchema, getAppVersionedSchema. | Old system gone. |
| **5** | Per-module format convergence: align TOML with contract, delete encode/decode as they become identity. | Minimal CLI — validate and send. |

**Why this order:** Phase 2 (implement AppModules) before Phase 3 (replace ExtensionInstance) eliminates the need for a temporary bridge/adapter module. Each Phase 2 module is an independent PR — add one file, add one test file, add to registry. If a module's `encode()` has a bug, remove it from the registry and the old spec handles it. Zero interim state beyond "some modules are on AppModule, others are still on old specs."
