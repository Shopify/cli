# Phase 2: Step-by-Step Implementation Guide

## Table of Contents

1. [How to Implement Any Non-Config AppModule](#section-1-how-to-implement-any-non-config-appmodule)
   - 1.8 [Error Handling for encode() Failures](#18-error-handling-for-encode-failures)
2. [Batch 1 -- Sequential (establish patterns)](#section-2-batch-1--sequential)
   - 2.4 [Contract-Only Module Conventions](#24-contract-only-module-conventions)
3. [Batch 2 -- Parallelizable](#section-3-batch-2--parallelizable)
4. [Batch 3 -- Parallelizable](#section-4-batch-3--parallelizable)
5. [Batch 4 -- Sequential (complex)](#section-5-batch-4--sequential)
6. [Batch 5 -- Sequential (most complex)](#section-6-batch-5--sequential)
7. [Verification Checklist Per Module](#section-7-verification-checklist-per-module)
   - 7.8 [Dev Mode Parity Testing](#78-dev-mode-parity-testing)

---

## Section 1: How to Implement Any Non-Config AppModule

Every non-config extension module follows the same mechanical pattern. This section is the reference recipe. Each module-specific section later in this guide tells you _what_ to put in the encode() body and which tests to write, but _how_ the file is structured is always the same.

### 1.1 The File Template

Create the file at:
```
packages/app/src/cli/models/app/app-modules/<kebab-name>.ts
```

Every module file follows this structure:

```typescript
/**
 * <ModuleName> -- <one line description of complexity/purpose>.
 */

import {AppModule, EncodeContext} from '../app-module.js'
// ... other imports as needed (file I/O, locales, utilities)

// --- TOML shape (what the developer writes in .extension.toml) ---
interface <Name>Toml {
  // Fields from the TOML config that encode() reads.
  // Include [key: string]: unknown to accept extra fields silently.
  [key: string]: unknown
}

// --- Contract shape (what the server receives) ---
interface <Name>Contract {
  // Fields sent to the server API.
}

// --- Helper functions (if any, keep private to this file) ---

// --- Module class ---
export class <Name>Module extends AppModule<<Name>Toml, <Name>Contract> {
  constructor() {
    super({identifier: '<spec_identifier>', uidStrategy: 'uuid'})
  }

  async encode(toml: <Name>Toml, context: EncodeContext): Promise<<Name>Contract> {
    // Transform TOML -> contract shape.
    // This must produce IDENTICAL output to the old spec.deployConfig().
    return { /* ... */ }
  }
}

export const <camelName>Module = new <Name>Module()
```

Key rules:
- **`identifier`** must exactly match the old spec's `identifier` string. This is how `extension-instance.ts` finds the module in `allAppModules`.
- **`uidStrategy`** is `'uuid'` for all non-config extensions (they each own their own `.extension.toml` file and have UUIDs for identity).
- **No `tomlKeys`** -- omitting `tomlKeys` means the module owns its entire file (it does not extract from a shared `shopify.app.toml`).
- **Export a singleton instance** (`export const fooModule = new FooModule()`) for registration.

### 1.2 The Constructor Pattern

All non-config extensions use this exact constructor call:

```typescript
constructor() {
  super({identifier: '<identifier>', uidStrategy: 'uuid'})
}
```

There is no `tomlKeys` parameter. The base class `extract()` method returns the entire TOML content when `tomlKeys` is absent, which is the correct behavior for extension modules that own their whole file.

### 1.3 The encode() Pattern

Read the old spec's `deployConfig` function. The old signature is:

```typescript
deployConfig: async (config, directory, apiKey, moduleId) => { ... }
```

The new signature is:

```typescript
async encode(toml: TToml, context: EncodeContext): Promise<TContract>
```

The mapping is:
- `config` --> `toml` (same data, just renamed)
- `directory` --> `context.directory`
- `apiKey` --> `context.apiKey`
- `moduleId` --> not used (was always `undefined` in the old callsite)

**Translation rule:** Copy the body of the old `deployConfig` into `encode()`, then mechanically replace `config` with `toml`, `directory` with `context.directory`, and `apiKey` with `context.apiKey`. Adjust types. That is the entire encode implementation.

### 1.4 The Parity Test Pattern

Create the test file at:
```
packages/app/src/cli/models/app/app-modules/<kebab-name>.test.ts
```

Or add test cases to the existing `non-config-parity.test.ts` file. The prototype uses the latter pattern for the first three modules, but individual test files are cleaner for parallel development.

The parity test structure:

```typescript
import {<camelName>Module} from './<kebab-name>.js'
import <specName> from '../../extensions/specifications/<spec_file>.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

// Mock file system, crypto, locales as needed (see below)

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('<Name>Module encode parity', () => {
  test('full config', async () => {
    const config = { /* all fields populated */ }

    const newResult = await <camelName>Module.encode(config, encodeCtx)
    const oldResult = await <specName>.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config', async () => {
    const config = { /* only required fields */ }

    const newResult = await <camelName>Module.encode(config, encodeCtx)
    const oldResult = await <specName>.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

**Common mocks you will need:**

```typescript
// For modules that check file existence (function, flow_template, etc.)
vi.mock('@shopify/cli-kit/node/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/fs')>()
  return {
    ...actual,
    fileExists: vi.fn().mockResolvedValue(false),
    readFile: vi.fn().mockResolvedValue('mock-file-content'),
    glob: vi.fn().mockResolvedValue([]),
    fileSize: vi.fn().mockResolvedValue(0),
  }
})

// For function module (randomUUID must be deterministic for parity)
vi.mock('@shopify/cli-kit/node/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/crypto')>()
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('deterministic-uuid'),
  }
})

// For modules that load locales
vi.mock('../../../utilities/extensions/locales-configuration.js', () => ({
  loadLocalesConfig: vi.fn().mockResolvedValue({}),
}))

// For flow modules that use serializeFields/loadSchemaFromPath
vi.mock('../../../services/flow/serialize-fields.js', async (importOriginal) => {
  return importOriginal()  // use real implementation
})
vi.mock('../../../services/flow/utils.js', () => ({
  loadSchemaFromPath: vi.fn().mockResolvedValue(''),
}))
```

### 1.5 How to Register in index.ts

After creating the module file and tests, register it in:
```
packages/app/src/cli/models/app/app-modules/index.ts
```

Add two things:

1. **Import and re-export:**
```typescript
import {<camelName>Module} from './<kebab-name>.js'
// ...
export {<camelName>Module} from './<kebab-name>.js'
```

2. **Add to `allAppModules` array** (in the non-config extensions section):
```typescript
export const allAppModules: AnyAppModule[] = [
  // ... existing config modules ...

  // Non-config extensions (uuid UID, own .extension.toml)
  checkoutPostPurchaseModule,
  functionModule,
  uiExtensionModule,
  <camelName>Module,    // <-- add here
]
```

### 1.6 How It Gets Picked Up Automatically

In `extension-instance.ts`, the `deployConfig()` method already has this routing logic:

```typescript
async deployConfig({apiKey, appConfiguration}: ExtensionDeployConfigOptions) {
  // Path 1: Modules with AppModule encode
  const appModule = allAppModules.find((mod) => mod.identifier === this.specification.identifier)
  if (appModule) {
    const encoded = await appModule.encode(this.configuration, {
      appConfiguration,
      directory: this.directory,
      apiKey,
    })
    // ... contract validation ...
    return encoded
  }

  // Path 2: Fallback for modules not yet on AppModule
  const deployConfig = await this.specification.deployConfig?.(...)
  // ...
}
```

Once your module is in `allAppModules` with a matching `identifier`, Path 1 fires instead of Path 2. No other wiring is needed. The old spec's `deployConfig` still exists but is no longer called for that extension type.

### 1.7 Running Tests

```bash
# Run just the parity tests
npx vitest run packages/app/src/cli/models/app/app-modules/<kebab-name>.test.ts

# Run the existing spec tests (must still pass)
npx vitest run packages/app/src/cli/models/extensions/specifications/<spec_file>.test.ts

# Run the full app package test suite
npx vitest run packages/app/
```

### 1.8 Error Handling for encode() Failures

#### The Problem

If `appModule.encode()` throws an unhandled exception (e.g., file I/O failure reading locales, unexpected data shape from TOML, missing dependency `package.json`), the entire deploy crashes with an unhandled error. The old `spec.deployConfig()` had implicit error handling at some callsites, and callers could rely on the overall deploy error handling wrapping the call. With the new AppModule routing in `extension-instance.ts`, an unhandled throw in `encode()` propagates directly and crashes the deploy before the fallback path (Path 2) can be attempted.

#### The Fix

In `packages/app/src/cli/models/extensions/extension-instance.ts`, wrap the `appModule.encode()` call in Path 1 with try/catch so that failures gracefully degrade to Path 2 during the migration period:

```typescript
// Path 1: Modules with AppModule encode -- the universal path
const appModule = allAppModules.find((mod) => mod.identifier === this.specification.identifier)
if (appModule) {
  try {
    const encoded = (await appModule.encode(this.configuration, {
      appConfiguration,
      directory: this.directory,
      apiKey,
    })) as {[key: string]: unknown}
    if (!encoded || Object.keys(encoded).length === 0) return undefined

    // Post-encode contract validation... (same as before)
    return encoded
  } catch (error) {
    outputDebug(
      `AppModule.encode() failed for "${this.handle}" (${this.specification.identifier}): ${error}`
    )
    // Graceful degradation: fall through to Path 2 (old spec)
  }
}

// Path 2: Fallback for modules not yet on AppModule (or if encode() failed)
```

#### Why Graceful Degradation

During the migration, both paths exist. If the new `encode()` fails, falling back to the old `spec.deployConfig()` / `spec.transformLocalToRemote()` ensures no regression for the developer. This is a safety net that prevents the migration from causing deploy failures in production.

Once the old paths are removed in Phase 4, the try/catch should be changed to re-throw the error instead of falling through, since there will be no fallback path available. At that point, each module's `encode()` is the sole source of truth and errors must surface.

#### Timing

This code change should be made as part of Phase 2 Batch 1 (when the first non-config module beyond the prototype is added). It is a prerequisite for safe rollout of any new module, not something to defer to later batches.

### 1.9 Branching strategy

See `docs/audit/branching-strategy.md` for the full branching and review strategy.

Phase 2 uses **Batch 1 as a Graphite stack or single PR**, followed by **independent branches** for Batches 2-5 (all parallelizable after Batch 1 merges). Each module is its own PR touching only its new file, its test file, and one line in `index.ts`.

---

## Section 2: Batch 1 -- Sequential

These modules establish the pattern. They must be done first and sequentially so that any issues with the mechanical pattern are caught before parallelization begins.

### 2.1 Module: checkout_post_purchase (ALREADY PROTOTYPED)

**Status:** Implementation and parity tests already exist. This PR only needs registration and verification.

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/checkout_post_purchase.ts`

**Module file:** `packages/app/src/cli/models/app/app-modules/checkout-post-purchase.ts` (already exists)

**Test file:** Parity tests in `non-config-parity.test.ts` (already exists and passes)

#### Steps

1. **Verify the module is already registered in `index.ts`.**
   It is -- `checkoutPostPurchaseModule` is already in `allAppModules`.

2. **Run parity tests to confirm they still pass:**
   ```bash
   npx vitest run packages/app/src/cli/models/app/app-modules/non-config-parity.test.ts
   ```

3. **Run existing spec tests to confirm no regression:**
   ```bash
   npx vitest run packages/app/src/cli/models/extensions/specifications/checkout_post_purchase.test.ts
   ```

4. **Manual verification:** Deploy an app with a `checkout_post_purchase` extension. Confirm identical behavior.

**PR scope:** Essentially a no-op verification PR. If parity tests pass and the module is already registered, this is done.

---

### 2.2 Module: theme

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/theme.ts`

**Old spec identifier:** `'theme'`

**Old deployConfig logic:**
```typescript
deployConfig: async () => {
  return {theme_extension: {files: {}}}
}
```

This is the simplest possible encode -- a static object with no inputs.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/theme.ts`

```typescript
/**
 * Theme -- static encode, complexity is in preDeployValidation (file validation).
 * Phase 2 implements encode() only. Validation moves in a later step.
 */

import {AppModule, EncodeContext} from '../app-module.js'

interface ThemeToml {
  [key: string]: unknown
}

interface ThemeContract {
  theme_extension: {files: Record<string, never>}
}

export class ThemeModule extends AppModule<ThemeToml, ThemeContract> {
  constructor() {
    super({identifier: 'theme', uidStrategy: 'uuid'})
  }

  async encode(_toml: ThemeToml, _context: EncodeContext): Promise<ThemeContract> {
    return {theme_extension: {files: {}}}
  }
}

export const themeModule = new ThemeModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/theme.test.ts`

```typescript
import {themeModule} from './theme.js'
import themeSpec from '../../extensions/specifications/theme.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('ThemeModule encode parity', () => {
  test('always returns static object', async () => {
    const config = {name: 'my-theme', type: 'theme'}

    const newResult = await themeModule.encode(config, encodeCtx)
    const oldResult = await themeSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('ignores all config fields', async () => {
    const config = {name: 'my-theme', type: 'theme', extra: 'stuff', nested: {a: 1}}

    const newResult = await themeModule.encode(config, encodeCtx)
    expect(newResult).toEqual({theme_extension: {files: {}}})
  })
})
```

#### Step 3: Register in index.ts

Add to `packages/app/src/cli/models/app/app-modules/index.ts`:
- Import: `import {themeModule} from './theme.js'`
- Re-export: `export {themeModule} from './theme.js'`
- Add `themeModule` to `allAppModules` array

#### Step 4: Verify

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/theme.test.ts
npx vitest run packages/app/src/cli/models/extensions/specifications/theme.test.ts
```

**Note on preDeployValidation:** The old spec has `preDeployValidation` that calls `validateThemeExtension()` (~60 lines of file system validation). This validation logic does NOT need to move to the AppModule in Phase 2. It remains on the old spec and is called through `ExtensionInstance.preDeployValidation()` which delegates to the spec, not the module. It will move in Phase 3 when `ExtensionInstance` is replaced.

---

### 2.3 Module: channel_config (contract-only passthrough)

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/channel.ts`

**Old spec identifier:** `'channel_config'`

**Old deployConfig logic** (from `createContractBasedModuleSpecification`):
```typescript
deployConfig: async (config, directory) => {
  let parsedConfig = configWithoutFirstClassFields(config)
  // no localization feature for channel_config
  return parsedConfig
}
```

Where `configWithoutFirstClassFields` strips `type`, `handle`, `uid`, `path`, `extensions` and passes through everything else.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/channel-config.ts`

```typescript
/**
 * Channel Config -- contract-only module with passthrough encode.
 * Strips first-class TOML fields (type, handle, uid, path, extensions)
 * and passes through everything else.
 */

import {AppModule, EncodeContext} from '../app-module.js'

interface ChannelConfigToml {
  type?: string
  handle?: string
  uid?: string
  path?: string
  extensions?: unknown
  [key: string]: unknown
}

export class ChannelConfigModule extends AppModule<ChannelConfigToml, Record<string, unknown>> {
  constructor() {
    super({identifier: 'channel_config', uidStrategy: 'uuid'})
  }

  async encode(toml: ChannelConfigToml, _context: EncodeContext): Promise<Record<string, unknown>> {
    const {type, handle, uid, path, extensions, ...config} = toml
    return config
  }
}

export const channelConfigModule = new ChannelConfigModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/channel-config.test.ts`

```typescript
import {channelConfigModule} from './channel-config.js'
import channelSpec from '../../extensions/specifications/channel.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('ChannelConfigModule encode parity', () => {
  test('strips first-class fields and passes through rest', async () => {
    const config = {
      type: 'channel_config',
      handle: 'my-channel',
      uid: 'abc-123',
      path: '/some/path',
      extensions: [],
      custom_field: 'value',
      nested: {key: 'val'},
    }

    const newResult = await channelConfigModule.encode(config, encodeCtx)
    const oldResult = await channelSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config (only first-class fields)', async () => {
    const config = {type: 'channel_config', handle: 'ch'}

    const newResult = await channelConfigModule.encode(config, encodeCtx)
    expect(newResult).toEqual({})
  })
})
```

#### Step 3: Register in index.ts

Add `channelConfigModule` to imports, re-exports, and `allAppModules`.

#### Step 4: Verify

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/channel-config.test.ts
```

---

### 2.4 Contract-Only Module Conventions

This section documents a behavioral difference between the old `createContractBasedModuleSpecification()` helper and the new AppModule system that all implementors of contract-only modules must be aware of.

#### Old behavior: automatic field stripping

The old `createContractBasedModuleSpecification()` used a helper called `configWithoutFirstClassFields()` that automatically stripped the following TOML fields before sending data to the API:
- `type`
- `handle`
- `uid`
- `path`
- `extensions`

This stripping happened implicitly for every contract-based module. Developers did not need to think about it, but it was also easy to forget that it was happening.

#### New behavior: explicit field selection

In the new AppModule system, the base class `encode()` default is a passthrough -- it does NOT strip these fields. Each module is responsible for its own field selection.

For contract-only modules (like `channel_config`, and any future contract-based modules) that need this stripping behavior, each module's `encode()` must explicitly destructure and omit the first-class fields:

```typescript
async encode(toml: ChannelConfigToml, _context: EncodeContext): Promise<Record<string, unknown>> {
  const {type, handle, uid, path, extensions, ...rest} = toml
  return rest
}
```

#### Design rationale

This is intentional: explicit is better than implicit. The old automatic stripping was a hidden behavior that was easy to forget about and difficult to debug when something went wrong. Making each module responsible for its own field selection is clearer and makes the data flow visible in each module's code.

#### Utility helper (optional, if many modules need this)

If many contract-only modules end up needing this same destructuring pattern, consider adding a shared utility function:

```typescript
// In a shared utility file (e.g., app-modules/utils.ts)
export function stripFirstClassFields(toml: Record<string, unknown>): Record<string, unknown> {
  const {type, handle, uid, path, extensions, ...rest} = toml
  return rest
}
```

Each module would then call it explicitly in its `encode()`:

```typescript
async encode(toml: MyModuleToml, _context: EncodeContext): Promise<Record<string, unknown>> {
  return stripFirstClassFields(toml)
}
```

This keeps the behavior visible while reducing boilerplate. Introduce this utility only when there are 3+ modules using the same pattern.

---

## Section 3: Batch 2 -- Parallelizable After Batch 1

Once Batch 1 is merged and the mechanical pattern is proven, these four modules can be implemented in parallel by different engineers. Each is independent.

### 3.1 Module: checkout_ui_extension

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/checkout_ui_extension.ts`

**Old spec identifier:** `'checkout_ui_extension'`

**Old deployConfig:**
```typescript
deployConfig: async (config, directory) => {
  return {
    extension_points: config.extension_points,
    capabilities: config.capabilities,
    supported_features: config.supported_features,
    metafields: config.metafields ?? [],
    name: config.name,
    settings: config.settings,
    localization: await loadLocalesConfig(directory, 'checkout_ui'),
  }
}
```

**Complexity:** Mostly passthrough fields. One async call: `loadLocalesConfig(directory, 'checkout_ui')`.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/checkout-ui.ts`

```typescript
/**
 * Checkout UI Extension -- field passthrough plus localization loading.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'

interface CheckoutUIToml {
  name: string
  extension_points?: string[]
  capabilities?: unknown
  supported_features?: unknown
  metafields?: {namespace: string; key: string}[]
  settings?: {fields?: unknown}
  [key: string]: unknown
}

interface CheckoutUIContract {
  extension_points?: string[]
  capabilities?: unknown
  supported_features?: unknown
  metafields: {namespace: string; key: string}[]
  name: string
  settings?: {fields?: unknown}
  localization: unknown
}

export class CheckoutUIModule extends AppModule<CheckoutUIToml, CheckoutUIContract> {
  constructor() {
    super({identifier: 'checkout_ui_extension', uidStrategy: 'uuid'})
  }

  async encode(toml: CheckoutUIToml, context: EncodeContext): Promise<CheckoutUIContract> {
    return {
      extension_points: toml.extension_points,
      capabilities: toml.capabilities,
      supported_features: toml.supported_features,
      metafields: toml.metafields ?? [],
      name: toml.name,
      settings: toml.settings,
      localization: await loadLocalesConfig(context.directory, 'checkout_ui'),
    }
  }
}

export const checkoutUIModule = new CheckoutUIModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/checkout-ui.test.ts`

```typescript
import {checkoutUIModule} from './checkout-ui.js'
import checkoutUISpec from '../../extensions/specifications/checkout_ui_extension.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../utilities/extensions/locales-configuration.js', () => ({
  loadLocalesConfig: vi.fn().mockResolvedValue({en: {greeting: 'Hello'}}),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('CheckoutUIModule encode parity', () => {
  test('full config', async () => {
    const config = {
      name: 'my-checkout-ui',
      type: 'checkout_ui_extension',
      extension_points: ['Checkout::Dynamic::Render'],
      capabilities: {network_access: true},
      supported_features: ['some-feature'],
      metafields: [{namespace: 'ns', key: 'k'}],
      settings: {fields: [{key: 'test', type: 'single_line_text_field'}]},
    }

    const newResult = await checkoutUIModule.encode(config, encodeCtx)
    const oldResult = await checkoutUISpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config (metafields defaults to empty array)', async () => {
    const config = {
      name: 'my-checkout-ui',
      type: 'checkout_ui_extension',
    }

    const newResult = await checkoutUIModule.encode(config, encodeCtx)
    const oldResult = await checkoutUISpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `checkoutUIModule` to imports, re-exports, and `allAppModules`.

#### Step 4: Verify

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/checkout-ui.test.ts
npx vitest run packages/app/src/cli/models/extensions/specifications/checkout_ui_extension.test.ts
```

---

### 3.2 Module: web_pixel_extension

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/web_pixel_extension.ts`

**Old spec identifier:** `'web_pixel_extension'`

**Old deployConfig:**
```typescript
deployConfig: async (config, _) => {
  return {
    runtime_context: config.runtime_context,
    customer_privacy: config.customer_privacy,
    runtime_configuration_definition: config.settings,  // FIELD RENAME
  }
}
```

**Complexity:** Simple field passthrough with one rename: `settings` --> `runtime_configuration_definition`. No async operations.

**Important:** The old spec also has `buildValidation` (bundle size check) and `preDeployValidation` (deprecated `configuration` property check). These validations stay on the old spec for Phase 2 -- they are called through `ExtensionInstance`, not through the module.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/web-pixel.ts`

```typescript
/**
 * Web Pixel Extension -- simple field passthrough with one rename.
 * settings -> runtime_configuration_definition
 */

import {AppModule, EncodeContext} from '../app-module.js'

interface WebPixelToml {
  runtime_context: string
  customer_privacy?: {
    analytics: boolean
    preferences: boolean
    marketing: boolean
    sale_of_data: 'enabled' | 'disabled' | 'ldu'
  }
  settings?: unknown
  [key: string]: unknown
}

interface WebPixelContract {
  runtime_context: string
  customer_privacy?: WebPixelToml['customer_privacy']
  runtime_configuration_definition?: unknown
}

export class WebPixelModule extends AppModule<WebPixelToml, WebPixelContract> {
  constructor() {
    super({identifier: 'web_pixel_extension', uidStrategy: 'uuid'})
  }

  async encode(toml: WebPixelToml, _context: EncodeContext): Promise<WebPixelContract> {
    return {
      runtime_context: toml.runtime_context,
      customer_privacy: toml.customer_privacy,
      runtime_configuration_definition: toml.settings,
    }
  }
}

export const webPixelModule = new WebPixelModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/web-pixel.test.ts`

```typescript
import {webPixelModule} from './web-pixel.js'
import webPixelSpec from '../../extensions/specifications/web_pixel_extension.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('WebPixelModule encode parity', () => {
  test('full config with settings renamed to runtime_configuration_definition', async () => {
    const config = {
      name: 'my-pixel',
      type: 'web_pixel_extension',
      runtime_context: 'strict',
      customer_privacy: {
        analytics: true,
        preferences: true,
        marketing: false,
        sale_of_data: 'enabled' as const,
      },
      settings: {type: 'object', properties: {trackingId: {type: 'string'}}},
    }

    const newResult = await webPixelModule.encode(config, encodeCtx)
    const oldResult = await webPixelSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config (no optional fields)', async () => {
    const config = {
      name: 'my-pixel',
      type: 'web_pixel_extension',
      runtime_context: 'strict',
    }

    const newResult = await webPixelModule.encode(config, encodeCtx)
    const oldResult = await webPixelSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `webPixelModule` to imports, re-exports, and `allAppModules`.

#### Step 4: Verify

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/web-pixel.test.ts
npx vitest run packages/app/src/cli/models/extensions/specifications/web_pixel_extension.test.ts
```

---

### 3.3 Module: tax_calculation

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/tax_calculation.ts`

**Old spec identifier:** `'tax_calculation'`

**Old deployConfig:**
```typescript
deployConfig: async (config, _) => {
  return {
    production_api_base_url: config.production_api_base_url,
    benchmark_api_base_url: config.benchmark_api_base_url,
    calculate_taxes_api_endpoint: config.calculate_taxes_api_endpoint,
    metafields: config.metafields,
    cart_line_properties: config.cart_line_properties,
    api_version: config.api_version,
    metafield_identifiers: config.input?.metafield_identifiers,  // UNWRAP
  }
}
```

**Complexity:** Mostly passthrough. One unwrap: `config.input?.metafield_identifiers` --> `metafield_identifiers` (top-level).

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/tax-calculation.ts`

```typescript
/**
 * Tax Calculation -- field passthrough with one unwrap (input.metafield_identifiers).
 */

import {AppModule, EncodeContext} from '../app-module.js'

interface TaxCalculationToml {
  production_api_base_url: string
  benchmark_api_base_url?: string
  calculate_taxes_api_endpoint: string
  metafields?: {namespace: string; key: string}[]
  cart_line_properties?: {key: string}[]
  api_version?: string
  input?: {
    metafield_identifiers?: {namespace: string; key: string}
  }
  [key: string]: unknown
}

interface TaxCalculationContract {
  production_api_base_url: string
  benchmark_api_base_url?: string
  calculate_taxes_api_endpoint: string
  metafields?: {namespace: string; key: string}[]
  cart_line_properties?: {key: string}[]
  api_version?: string
  metafield_identifiers?: {namespace: string; key: string}
}

export class TaxCalculationModule extends AppModule<TaxCalculationToml, TaxCalculationContract> {
  constructor() {
    super({identifier: 'tax_calculation', uidStrategy: 'uuid'})
  }

  async encode(toml: TaxCalculationToml, _context: EncodeContext): Promise<TaxCalculationContract> {
    return {
      production_api_base_url: toml.production_api_base_url,
      benchmark_api_base_url: toml.benchmark_api_base_url,
      calculate_taxes_api_endpoint: toml.calculate_taxes_api_endpoint,
      metafields: toml.metafields,
      cart_line_properties: toml.cart_line_properties,
      api_version: toml.api_version,
      metafield_identifiers: toml.input?.metafield_identifiers,
    }
  }
}

export const taxCalculationModule = new TaxCalculationModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/tax-calculation.test.ts`

```typescript
import {taxCalculationModule} from './tax-calculation.js'
import taxCalcSpec from '../../extensions/specifications/tax_calculation.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('TaxCalculationModule encode parity', () => {
  test('full config with input.metafield_identifiers unwrapped', async () => {
    const config = {
      name: 'my-tax',
      type: 'tax_calculation',
      production_api_base_url: 'https://prod.example.com',
      benchmark_api_base_url: 'https://bench.example.com',
      calculate_taxes_api_endpoint: '/calculate',
      metafields: [{namespace: 'ns', key: 'k'}],
      cart_line_properties: [{key: 'gift_wrap'}],
      api_version: '2024-01',
      input: {
        metafield_identifiers: {namespace: 'tax', key: 'rate'},
      },
    }

    const newResult = await taxCalculationModule.encode(config, encodeCtx)
    const oldResult = await taxCalcSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config without optional fields', async () => {
    const config = {
      name: 'my-tax',
      type: 'tax_calculation',
      production_api_base_url: 'https://prod.example.com',
      calculate_taxes_api_endpoint: '/calculate',
    }

    const newResult = await taxCalculationModule.encode(config, encodeCtx)
    const oldResult = await taxCalcSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('without input section (metafield_identifiers should be undefined)', async () => {
    const config = {
      name: 'my-tax',
      type: 'tax_calculation',
      production_api_base_url: 'https://prod.example.com',
      calculate_taxes_api_endpoint: '/calculate',
    }

    const newResult = await taxCalculationModule.encode(config, encodeCtx)
    expect(newResult.metafield_identifiers).toBeUndefined()
  })
})
```

#### Step 3: Register in index.ts

Add `taxCalculationModule` to imports, re-exports, and `allAppModules`.

---

### 3.4 Module: editor_extension_collection

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/editor_extension_collection.ts`

**Old spec identifier:** `'editor_extension_collection'`

**Old deployConfig:**
```typescript
deployConfig: async (config, directory) => {
  return {
    name: config.name,
    handle: config.handle,
    in_collection: config.inCollection,
    localization: await loadLocalesConfig(directory, config.name),
  }
}
```

**Important Zod transform context:** The old spec has a Zod `.transform()` that merges `includes` (string array) and `include` (object array with handles) into `inCollection`. This transform runs during TOML parsing, BEFORE `deployConfig`/`encode` is called. So `config.inCollection` is already the merged array when it reaches encode(). The module receives the already-transformed data -- no need to replicate the merge logic.

**Complexity:** Simple mapping plus localization. The `inCollection` field is already merged by the Zod transform.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/editor-extension-collection.ts`

```typescript
/**
 * Editor Extension Collection -- simple mapping plus localization.
 * Note: inCollection is pre-merged by the Zod transform in the schema.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'

interface EditorExtensionCollectionToml {
  name: string
  handle?: string
  inCollection?: {handle: string}[]
  [key: string]: unknown
}

interface EditorExtensionCollectionContract {
  name: string
  handle?: string
  in_collection?: {handle: string}[]
  localization: unknown
}

export class EditorExtensionCollectionModule extends AppModule<
  EditorExtensionCollectionToml,
  EditorExtensionCollectionContract
> {
  constructor() {
    super({identifier: 'editor_extension_collection', uidStrategy: 'uuid'})
  }

  async encode(
    toml: EditorExtensionCollectionToml,
    context: EncodeContext,
  ): Promise<EditorExtensionCollectionContract> {
    return {
      name: toml.name,
      handle: toml.handle,
      in_collection: toml.inCollection,
      localization: await loadLocalesConfig(context.directory, toml.name),
    }
  }
}

export const editorExtensionCollectionModule = new EditorExtensionCollectionModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/editor-extension-collection.test.ts`

Test with the ALREADY-TRANSFORMED data (after Zod transform). The parity test must provide data in the shape that exists after parsing, since both `encode()` and `deployConfig()` receive post-transform data.

```typescript
import {editorExtensionCollectionModule} from './editor-extension-collection.js'
import editorSpec from '../../extensions/specifications/editor_extension_collection.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../utilities/extensions/locales-configuration.js', () => ({
  loadLocalesConfig: vi.fn().mockResolvedValue({}),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('EditorExtensionCollectionModule encode parity', () => {
  test('with inCollection (post-Zod-transform shape)', async () => {
    // This is what the config looks like AFTER the Zod transform runs:
    const config = {
      name: 'my-collection',
      type: 'editor_extension_collection',
      handle: 'my-collection-handle',
      inCollection: [
        {handle: 'ext-a'},
        {handle: 'ext-b'},
      ],
    }

    const newResult = await editorExtensionCollectionModule.encode(config, encodeCtx)
    const oldResult = await editorSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('without inCollection', async () => {
    const config = {
      name: 'my-collection',
      type: 'editor_extension_collection',
    }

    const newResult = await editorExtensionCollectionModule.encode(config, encodeCtx)
    const oldResult = await editorSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `editorExtensionCollectionModule` to imports, re-exports, and `allAppModules`.

---

## Section 4: Batch 3 -- Parallelizable

These modules involve file I/O, field restructuring, or npm dependency reads. All six can be done in parallel after Batch 2 is merged.

### 4.1 Module: function (ALREADY PROTOTYPED)

**Status:** Implementation exists at `packages/app/src/cli/models/app/app-modules/function.ts`. Parity tests exist in `non-config-parity.test.ts`.

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/function.ts`

**Old spec identifier:** `'function'`

#### What already exists

The `FunctionModule` class with full `encode()` implementation including:
- Reading `input.graphql` from disk
- Reading per-target input queries
- Building UI config (field restructuring: `ui.paths` --> `app_bridge`, `ui.handle` --> `ui_extension_handle`)
- `randomUUID()` for `module_id`
- `input.variables` --> `input_query_variables.single_json_metafield` wrapping
- `type === 'function' ? undefined : type` for `api_type`
- Localization loading

#### Steps

1. **Verify already registered in index.ts.** It is.

2. **Run parity tests:**
   ```bash
   npx vitest run packages/app/src/cli/models/app/app-modules/non-config-parity.test.ts
   ```

3. **Add more comprehensive test cases** (optional but recommended):
   - Test with `targeting` array that references an input_query file
   - Test with `ui.paths` and `ui.handle` both present
   - Test with `type: 'function'` (api_type should be undefined)
   - Test with `type: 'order_discounts'` (api_type should be 'order_discounts')

4. **Verify existing spec tests still pass:**
   ```bash
   npx vitest run packages/app/src/cli/models/extensions/specifications/function.test.ts
   ```

**Note on randomUUID parity:** The parity test mocks `randomUUID` to return `'deterministic-uuid'`, making the comparison deterministic. Both old and new paths call `randomUUID()`, so with the same mock they produce the same `module_id`.

---

### 4.2 Module: flow_action

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/flow_action.ts`

**Old spec identifier:** `'flow_action'`

**Old deployConfig:**
```typescript
deployConfig: async (config, extensionPath) => {
  return {
    title: config.name,                                            // rename: name -> title
    description: config.description,
    url: config.runtime_url,                                       // rename: runtime_url -> url
    fields: serializeFields('flow_action', config.settings?.fields),
    validation_url: config.validation_url,
    custom_configuration_page_url: config.config_page_url,         // rename
    custom_configuration_page_preview_url: config.config_page_preview_url,  // rename
    schema_patch: await loadSchemaFromPath(extensionPath, config.schema),
    return_type_ref: config.return_type_ref,
  }
}
```

**Dependencies:**
- `serializeFields` from `../../../services/flow/serialize-fields.js` -- reuse as-is
- `loadSchemaFromPath` from `../../../services/flow/utils.js` -- reuse as-is

**Complexity:** Multiple field renames. Two imported utility functions. `loadSchemaFromPath` is async (reads a file from disk).

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/flow-action.ts`

```typescript
/**
 * Flow Action -- field renames, field serialization, schema file loading.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {serializeFields} from '../../../services/flow/serialize-fields.js'
import {loadSchemaFromPath} from '../../../services/flow/utils.js'

interface FlowActionToml {
  name: string
  description?: string
  runtime_url: string
  validation_url?: string
  config_page_url?: string
  config_page_preview_url?: string
  schema?: string
  return_type_ref?: string
  settings?: {fields?: unknown[]}
  [key: string]: unknown
}

interface FlowActionContract {
  title: string
  description?: string
  url: string
  fields: unknown[]
  validation_url?: string
  custom_configuration_page_url?: string
  custom_configuration_page_preview_url?: string
  schema_patch: string
  return_type_ref?: string
}

export class FlowActionModule extends AppModule<FlowActionToml, FlowActionContract> {
  constructor() {
    super({identifier: 'flow_action', uidStrategy: 'uuid'})
  }

  async encode(toml: FlowActionToml, context: EncodeContext): Promise<FlowActionContract> {
    return {
      title: toml.name,
      description: toml.description,
      url: toml.runtime_url,
      fields: serializeFields('flow_action', toml.settings?.fields as any),
      validation_url: toml.validation_url,
      custom_configuration_page_url: toml.config_page_url,
      custom_configuration_page_preview_url: toml.config_page_preview_url,
      schema_patch: await loadSchemaFromPath(context.directory, toml.schema),
      return_type_ref: toml.return_type_ref,
    }
  }
}

export const flowActionModule = new FlowActionModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/flow-action.test.ts`

```typescript
import {flowActionModule} from './flow-action.js'
import flowActionSpec from '../../extensions/specifications/flow_action.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../services/flow/utils.js', () => ({
  loadSchemaFromPath: vi.fn().mockResolvedValue(''),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('FlowActionModule encode parity', () => {
  test('full config with all field renames', async () => {
    const config = {
      name: 'my-action',
      type: 'flow_action',
      handle: 'my-action-handle',
      description: 'Does things',
      runtime_url: 'https://example.com/action',
      validation_url: 'https://example.com/validate',
      config_page_url: 'https://example.com/config',
      config_page_preview_url: 'https://example.com/preview',
      schema: 'schema.graphql',
      return_type_ref: 'MyReturnType',
      settings: {
        fields: [
          {key: 'email', name: 'Email', type: 'email', description: 'Customer email', required: true},
        ],
      },
    }

    const newResult = await flowActionModule.encode(config, encodeCtx)
    const oldResult = await flowActionSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config (no optional fields)', async () => {
    const config = {
      name: 'my-action',
      type: 'flow_action',
      handle: 'my-action-handle',
      runtime_url: 'https://example.com/action',
    }

    const newResult = await flowActionModule.encode(config, encodeCtx)
    const oldResult = await flowActionSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `flowActionModule` to imports, re-exports, and `allAppModules`.

---

### 4.3 Module: flow_trigger

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/flow_trigger.ts`

**Old spec identifier:** `'flow_trigger'`

**Old deployConfig:**
```typescript
deployConfig: async (config, extensionPath) => {
  return {
    title: config.name,
    description: config.description,
    fields: serializeFields('flow_trigger', config.settings?.fields),
    schema_patch: await loadSchemaFromPath(extensionPath, config.schema),
  }
}
```

**Complexity:** Simpler version of flow_action. Same dependencies, fewer fields.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/flow-trigger.ts`

```typescript
/**
 * Flow Trigger -- simpler version of flow_action. Field renames + serialization.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {serializeFields} from '../../../services/flow/serialize-fields.js'
import {loadSchemaFromPath} from '../../../services/flow/utils.js'

interface FlowTriggerToml {
  name: string
  description?: string
  schema?: string
  settings?: {fields?: unknown[]}
  [key: string]: unknown
}

interface FlowTriggerContract {
  title: string
  description?: string
  fields: unknown[]
  schema_patch: string
}

export class FlowTriggerModule extends AppModule<FlowTriggerToml, FlowTriggerContract> {
  constructor() {
    super({identifier: 'flow_trigger', uidStrategy: 'uuid'})
  }

  async encode(toml: FlowTriggerToml, context: EncodeContext): Promise<FlowTriggerContract> {
    return {
      title: toml.name,
      description: toml.description,
      fields: serializeFields('flow_trigger', toml.settings?.fields as any),
      schema_patch: await loadSchemaFromPath(context.directory, toml.schema),
    }
  }
}

export const flowTriggerModule = new FlowTriggerModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/flow-trigger.test.ts`

```typescript
import {flowTriggerModule} from './flow-trigger.js'
import flowTriggerSpec from '../../extensions/specifications/flow_trigger.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../services/flow/utils.js', () => ({
  loadSchemaFromPath: vi.fn().mockResolvedValue(''),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('FlowTriggerModule encode parity', () => {
  test('full config', async () => {
    const config = {
      name: 'my-trigger',
      type: 'flow_trigger',
      handle: 'my-trigger-handle',
      description: 'Triggers things',
      schema: 'schema.graphql',
      settings: {
        fields: [
          {key: 'customer name', name: 'Customer Name', type: 'string', description: 'The name'},
        ],
      },
    }

    const newResult = await flowTriggerModule.encode(config, encodeCtx)
    const oldResult = await flowTriggerSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal config', async () => {
    const config = {
      name: 'my-trigger',
      type: 'flow_trigger',
      handle: 'my-trigger-handle',
    }

    const newResult = await flowTriggerModule.encode(config, encodeCtx)
    const oldResult = await flowTriggerSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `flowTriggerModule` to imports, re-exports, and `allAppModules`.

---

### 4.4 Module: flow_template

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/flow_template.ts`

**Old spec identifier:** `'flow_template'`

**Old deployConfig:**
```typescript
deployConfig: async (config, extensionPath) => {
  return {
    template_handle: config.handle,
    name: config.name,
    description: config.description,
    categories: config.template.categories,
    require_app: config.template.require_app,
    discoverable: config.template.discoverable,
    allow_one_click_activate: config.template.allow_one_click_activate,
    enabled: config.template.enabled,
    definition: await loadWorkflow(extensionPath, config.template.module),
    localization: await loadLocalesConfig(extensionPath, config.name),
  }
}
```

**`loadWorkflow` helper** (private to the old spec file):
```typescript
async function loadWorkflow(path: string, workflowPath: string) {
  const flowFilePaths = await glob(joinPath(path, workflowPath))
  const flowFilePath = flowFilePaths[0]
  if (!flowFilePath) {
    throw new AbortError(`Missing flow file with the path ${joinPath(path, workflowPath)}`)
  }
  return fs.readFileSync(flowFilePath, 'base64')
}
```

**Complexity:** Field unwrapping from `template.*` to top-level. `loadWorkflow()` globs for a `.flow` file and reads it as base64. Localization loading.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/flow-template.ts`

```typescript
/**
 * Flow Template -- field unwrapping from template.*, workflow file loading (base64),
 * and localization.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import fs from 'fs'

interface FlowTemplateToml {
  name: string
  handle?: string
  description: string
  template: {
    categories: string[]
    module: string
    require_app?: boolean
    discoverable?: boolean
    allow_one_click_activate?: boolean
    enabled?: boolean
  }
  [key: string]: unknown
}

interface FlowTemplateContract {
  template_handle?: string
  name: string
  description: string
  categories: string[]
  require_app?: boolean
  discoverable?: boolean
  allow_one_click_activate?: boolean
  enabled?: boolean
  definition: string
  localization: unknown
}

async function loadWorkflow(path: string, workflowPath: string): Promise<string> {
  const flowFilePaths = await glob(joinPath(path, workflowPath))
  const flowFilePath = flowFilePaths[0]
  if (!flowFilePath) {
    throw new AbortError(`Missing flow file with the path ${joinPath(path, workflowPath)}`)
  }
  return fs.readFileSync(flowFilePath, 'base64')
}

export class FlowTemplateModule extends AppModule<FlowTemplateToml, FlowTemplateContract> {
  constructor() {
    super({identifier: 'flow_template', uidStrategy: 'uuid'})
  }

  async encode(toml: FlowTemplateToml, context: EncodeContext): Promise<FlowTemplateContract> {
    return {
      template_handle: toml.handle,
      name: toml.name,
      description: toml.description,
      categories: toml.template.categories,
      require_app: toml.template.require_app,
      discoverable: toml.template.discoverable,
      allow_one_click_activate: toml.template.allow_one_click_activate,
      enabled: toml.template.enabled,
      definition: await loadWorkflow(context.directory, toml.template.module),
      localization: await loadLocalesConfig(context.directory, toml.name),
    }
  }
}

export const flowTemplateModule = new FlowTemplateModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/flow-template.test.ts`

```typescript
import {flowTemplateModule} from './flow-template.js'
import flowTemplateSpec from '../../extensions/specifications/flow_template.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/fs')>()
  return {
    ...actual,
    glob: vi.fn().mockResolvedValue(['/tmp/test-extension/workflow.flow']),
  }
})

// Mock fs.readFileSync for base64 reading
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: vi.fn().mockReturnValue('base64-encoded-workflow-content'),
    },
  }
})

vi.mock('../../../utilities/extensions/locales-configuration.js', () => ({
  loadLocalesConfig: vi.fn().mockResolvedValue({}),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('FlowTemplateModule encode parity', () => {
  test('full config with template fields unwrapped', async () => {
    const config = {
      name: 'my-template',
      type: 'flow_template',
      handle: 'my-template-handle',
      description: 'A flow template',
      template: {
        categories: ['orders', 'customers'],
        module: '*.flow',
        require_app: true,
        discoverable: true,
        allow_one_click_activate: false,
        enabled: true,
      },
    }

    const newResult = await flowTemplateModule.encode(config, encodeCtx)
    const oldResult = await flowTemplateSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('minimal template config (only required fields)', async () => {
    const config = {
      name: 'my-template',
      type: 'flow_template',
      handle: 'my-handle',
      description: 'A template',
      template: {
        categories: ['orders'],
        module: '*.flow',
      },
    }

    const newResult = await flowTemplateModule.encode(config, encodeCtx)
    const oldResult = await flowTemplateSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `flowTemplateModule` to imports, re-exports, and `allAppModules`.

---

### 4.5 Module: pos_ui_extension

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/pos_ui_extension.ts`

**Old spec identifier:** `'pos_ui_extension'`

**Old deployConfig:**
```typescript
deployConfig: async (config, directory) => {
  const result = await getDependencyVersion(dependency, directory)
  if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
  return {
    name: config.name,
    description: config.description,
    renderer_version: result?.version,
  }
}
```

Where `dependency = '@shopify/retail-ui-extensions'`.

**Complexity:** Reads renderer version from npm dependency's `package.json`. The `getDependencyVersion` function is from `../../app/app.js` and walks up the directory tree looking for `node_modules/@shopify/retail-ui-extensions/package.json`.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/pos-ui.ts`

```typescript
/**
 * POS UI Extension -- reads renderer version from npm dependency.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {getDependencyVersion} from '../app.js'
import {BugError} from '@shopify/cli-kit/node/error'

const DEPENDENCY = '@shopify/retail-ui-extensions'

interface PosUIToml {
  name: string
  description?: string
  [key: string]: unknown
}

interface PosUIContract {
  name: string
  description?: string
  renderer_version?: string
}

export class PosUIModule extends AppModule<PosUIToml, PosUIContract> {
  constructor() {
    super({identifier: 'pos_ui_extension', uidStrategy: 'uuid'})
  }

  async encode(toml: PosUIToml, context: EncodeContext): Promise<PosUIContract> {
    const result = await getDependencyVersion(DEPENDENCY, context.directory)
    if (result === 'not_found') throw new BugError(`Dependency ${DEPENDENCY} not found`)
    return {
      name: toml.name,
      description: toml.description,
      renderer_version: result?.version,
    }
  }
}

export const posUIModule = new PosUIModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/pos-ui.test.ts`

```typescript
import {posUIModule} from './pos-ui.js'
import posUISpec from '../../extensions/specifications/pos_ui_extension.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../app.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app.js')>()
  return {
    ...actual,
    getDependencyVersion: vi.fn().mockResolvedValue({version: '1.2.3'}),
  }
})

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('PosUIModule encode parity', () => {
  test('returns name, description, and renderer_version', async () => {
    const config = {
      name: 'my-pos-ext',
      type: 'pos_ui_extension',
      description: 'A POS extension',
    }

    const newResult = await posUIModule.encode(config, encodeCtx)
    const oldResult = await posUISpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('without description', async () => {
    const config = {
      name: 'my-pos-ext',
      type: 'pos_ui_extension',
    }

    const newResult = await posUIModule.encode(config, encodeCtx)
    const oldResult = await posUISpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `posUIModule` to imports, re-exports, and `allAppModules`.

---

### 4.6 Module: product_subscription

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/product_subscription.ts`

**Old spec identifier:** `'product_subscription'`

**Old deployConfig:**
```typescript
deployConfig: async (_, directory) => {
  const result = await getDependencyVersion(dependency, directory)
  if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
  return {renderer_version: result?.version}
}
```

Where `dependency = '@shopify/admin-ui-extensions'`.

**Complexity:** Even simpler than pos_ui -- config is completely ignored. Output is just `{renderer_version}`.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/product-subscription.ts`

```typescript
/**
 * Product Subscription -- ignores config, returns renderer version only.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {getDependencyVersion} from '../app.js'
import {BugError} from '@shopify/cli-kit/node/error'

const DEPENDENCY = '@shopify/admin-ui-extensions'

interface ProductSubscriptionToml {
  [key: string]: unknown
}

interface ProductSubscriptionContract {
  renderer_version?: string
}

export class ProductSubscriptionModule extends AppModule<ProductSubscriptionToml, ProductSubscriptionContract> {
  constructor() {
    super({identifier: 'product_subscription', uidStrategy: 'uuid'})
  }

  async encode(_toml: ProductSubscriptionToml, context: EncodeContext): Promise<ProductSubscriptionContract> {
    const result = await getDependencyVersion(DEPENDENCY, context.directory)
    if (result === 'not_found') throw new BugError(`Dependency ${DEPENDENCY} not found`)
    return {renderer_version: result?.version}
  }
}

export const productSubscriptionModule = new ProductSubscriptionModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/product-subscription.test.ts`

```typescript
import {productSubscriptionModule} from './product-subscription.js'
import productSubscriptionSpec from '../../extensions/specifications/product_subscription.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../app.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app.js')>()
  return {
    ...actual,
    getDependencyVersion: vi.fn().mockResolvedValue({version: '3.4.5'}),
  }
})

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('ProductSubscriptionModule encode parity', () => {
  test('ignores config, returns only renderer_version', async () => {
    const config = {
      name: 'my-sub',
      type: 'product_subscription',
      something: 'ignored',
    }

    const newResult = await productSubscriptionModule.encode(config, encodeCtx)
    const oldResult = await productSubscriptionSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Step 3: Register in index.ts

Add `productSubscriptionModule` to imports, re-exports, and `allAppModules`.

---

## Section 5: Batch 4 -- Sequential (complex, needs careful review)

### 5.1 Module: payments_extension

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/payments_app_extension.ts`

**Old spec identifier:** `'payments_extension'`

**Old deployConfig:**
```typescript
deployConfig: async (config, _) => {
  const target = config.targeting[0]?.target
  switch (target) {
    case OFFSITE_TARGET:
      return offsitePaymentsAppExtensionDeployConfig(config as OffsitePaymentsAppExtensionConfigType)
    case REDEEMABLE_TARGET:
      return redeemablePaymentsAppExtensionDeployConfig(config as RedeemablePaymentsAppExtensionConfigType)
    case CREDIT_CARD_TARGET:
      return creditCardPaymentsAppExtensionDeployConfig(config as CreditCardPaymentsAppExtensionConfigType)
    case CUSTOM_ONSITE_TARGET:
      return customOnsitePaymentsAppExtensionDeployConfig(config as CustomOnsitePaymentsAppExtensionConfigType)
    case CUSTOM_CREDIT_CARD_TARGET:
      return customCreditCardPaymentsAppExtensionDeployConfig(config as CustomCreditCardPaymentsAppExtensionConfigType)
    case CARD_PRESENT_TARGET:
      return cardPresentPaymentsAppExtensionDeployConfig(config as CardPresentPaymentsAppExtensionConfigType)
    default:
      return {}
  }
}
```

**Key decision:** Reuse all 6 existing deploy config functions. Do NOT rewrite the field mapping logic. The functions are well-tested in their own test files under `payments_app_extension_schemas/`.

**Complexity:** The dispatch logic is simple. The complexity is in the 6 variant schemas and their deploy config functions, but we reuse those as-is.

#### Step 1: Create the module file

**File:** `packages/app/src/cli/models/app/app-modules/payments.ts`

```typescript
/**
 * Payments Extension -- 6 payment variants, dispatches to existing deploy config functions.
 * The variant deploy config functions are reused as-is from payments_app_extension_schemas/.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {
  OFFSITE_TARGET,
  OffsitePaymentsAppExtensionConfigType,
  offsitePaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {
  REDEEMABLE_TARGET,
  RedeemablePaymentsAppExtensionConfigType,
  redeemablePaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/redeemable_payments_app_extension_schema.js'
import {
  CREDIT_CARD_TARGET,
  CreditCardPaymentsAppExtensionConfigType,
  creditCardPaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/credit_card_payments_app_extension_schema.js'
import {
  CUSTOM_ONSITE_TARGET,
  CustomOnsitePaymentsAppExtensionConfigType,
  customOnsitePaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/custom_onsite_payments_app_extension_schema.js'
import {
  CUSTOM_CREDIT_CARD_TARGET,
  CustomCreditCardPaymentsAppExtensionConfigType,
  customCreditCardPaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/custom_credit_card_payments_app_extension_schema.js'
import {
  CARD_PRESENT_TARGET,
  CardPresentPaymentsAppExtensionConfigType,
  cardPresentPaymentsAppExtensionDeployConfig,
} from '../../extensions/specifications/payments_app_extension_schemas/card_present_payments_app_extension_schema.js'

interface PaymentsToml {
  targeting: {target: string}[]
  [key: string]: unknown
}

export class PaymentsModule extends AppModule<PaymentsToml, Record<string, unknown>> {
  constructor() {
    super({identifier: 'payments_extension', uidStrategy: 'uuid'})
  }

  async encode(toml: PaymentsToml, _context: EncodeContext): Promise<Record<string, unknown>> {
    const target = toml.targeting[0]?.target
    switch (target) {
      case OFFSITE_TARGET:
        return (await offsitePaymentsAppExtensionDeployConfig(
          toml as unknown as OffsitePaymentsAppExtensionConfigType,
        )) ?? {}
      case REDEEMABLE_TARGET:
        return (await redeemablePaymentsAppExtensionDeployConfig(
          toml as unknown as RedeemablePaymentsAppExtensionConfigType,
        )) ?? {}
      case CREDIT_CARD_TARGET:
        return (await creditCardPaymentsAppExtensionDeployConfig(
          toml as unknown as CreditCardPaymentsAppExtensionConfigType,
        )) ?? {}
      case CUSTOM_ONSITE_TARGET:
        return (await customOnsitePaymentsAppExtensionDeployConfig(
          toml as unknown as CustomOnsitePaymentsAppExtensionConfigType,
        )) ?? {}
      case CUSTOM_CREDIT_CARD_TARGET:
        return (await customCreditCardPaymentsAppExtensionDeployConfig(
          toml as unknown as CustomCreditCardPaymentsAppExtensionConfigType,
        )) ?? {}
      case CARD_PRESENT_TARGET:
        return (await cardPresentPaymentsAppExtensionDeployConfig(
          toml as unknown as CardPresentPaymentsAppExtensionConfigType,
        )) ?? {}
      default:
        return {}
    }
  }
}

export const paymentsModule = new PaymentsModule()
```

#### Step 2: Create the test file

**File:** `packages/app/src/cli/models/app/app-modules/payments.test.ts`

Write one parity test per payment variant. Use representative config for each. The key thing is that the dispatch logic works correctly and the existing deploy config functions are called with the right data.

```typescript
import {paymentsModule} from './payments.js'
import paymentsSpec from '../../extensions/specifications/payments_app_extension.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

describe('PaymentsModule encode parity', () => {
  test('offsite payments variant', async () => {
    const config = {
      name: 'my-offsite',
      type: 'payments_extension',
      targeting: [{target: 'payments.offsite.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      capture_session_url: 'https://example.com/capture',
      void_session_url: 'https://example.com/void',
      merchant_label: 'My Payment',
      supported_countries: ['US', 'CA'],
      supported_payment_methods: ['visa'],
      test_mode_available: true,
      supports_3ds: false,
      supports_deferred_payments: false,
      supports_installments: false,
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('redeemable payments variant', async () => {
    const config = {
      name: 'my-redeemable',
      type: 'payments_extension',
      targeting: [{target: 'payments.redeemable.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      merchant_label: 'Gift Card',
      supported_countries: ['US'],
      supported_payment_methods: ['gift_card'],
      test_mode_available: true,
      balance_url: 'https://example.com/balance',
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('credit card variant', async () => {
    const config = {
      name: 'my-cc',
      type: 'payments_extension',
      targeting: [{target: 'payments.credit-card.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      capture_session_url: 'https://example.com/capture',
      void_session_url: 'https://example.com/void',
      merchant_label: 'CC Pay',
      supported_countries: ['US'],
      supported_payment_methods: ['visa'],
      test_mode_available: true,
      supports_3ds: false,
      supports_deferred_payments: false,
      supports_installments: false,
      encryption_certificate_fingerprint: 'abc123',
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('custom onsite variant', async () => {
    const config = {
      name: 'my-onsite',
      type: 'payments_extension',
      targeting: [{target: 'payments.custom-onsite.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      capture_session_url: 'https://example.com/capture',
      void_session_url: 'https://example.com/void',
      merchant_label: 'Onsite Pay',
      supported_countries: ['US'],
      supported_payment_methods: ['visa'],
      test_mode_available: true,
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('custom credit card variant', async () => {
    const config = {
      name: 'my-custom-cc',
      type: 'payments_extension',
      targeting: [{target: 'payments.custom-credit-card.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      capture_session_url: 'https://example.com/capture',
      void_session_url: 'https://example.com/void',
      merchant_label: 'Custom CC',
      supported_countries: ['US'],
      supported_payment_methods: ['visa'],
      test_mode_available: true,
      supports_3ds: false,
      supports_deferred_payments: false,
      supports_installments: false,
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('card present variant', async () => {
    const config = {
      name: 'my-card-present',
      type: 'payments_extension',
      targeting: [{target: 'payments.card-present.render'}],
      api_version: '2024-01',
      payment_session_url: 'https://example.com/pay',
      refund_session_url: 'https://example.com/refund',
      capture_session_url: 'https://example.com/capture',
      void_session_url: 'https://example.com/void',
      merchant_label: 'Card Present',
      supported_countries: ['US'],
      supported_payment_methods: ['visa'],
      test_mode_available: true,
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    const oldResult = await paymentsSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('unknown target returns empty object', async () => {
    const config = {
      name: 'unknown',
      type: 'payments_extension',
      targeting: [{target: 'payments.unknown.render'}],
    }

    const newResult = await paymentsModule.encode(config, encodeCtx)
    expect(newResult).toEqual({})
  })
})
```

**Testing note:** These parity tests may fail if the variant deploy config functions validate fields strictly. Look at the existing test files under `payments_app_extension_schemas/*.test.ts` for representative test data. Reuse those fixtures.

#### Step 3: Register in index.ts

Add `paymentsModule` to imports, re-exports, and `allAppModules`.

#### Step 4: Verify

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/payments.test.ts
npx vitest run packages/app/src/cli/models/extensions/specifications/payments_app_extension.test.ts
npx vitest run packages/app/src/cli/models/extensions/specifications/payments_app_extension_schemas/
```

---

## Section 6: Batch 5 -- Sequential (most complex)

### 6.1 Module: ui_extension (ALREADY PROTOTYPED -- encode only)

**Status:** The encode-only prototype exists at `packages/app/src/cli/models/app/app-modules/ui-extension.ts`. Parity tests for encode exist in `non-config-parity.test.ts`. The full module also needs optional capability methods.

**Old spec file:** `packages/app/src/cli/models/extensions/specifications/ui_extension.ts` (~462 lines)

**Old spec identifier:** `'ui_extension'`

This is the most complex module in the system. The encode is already prototyped and passing. The full Phase 2 implementation adds the remaining capability methods.

#### What already exists (encode-only prototype)

The existing prototype at `packages/app/src/cli/models/app/app-modules/ui-extension.ts` has:
- `UIExtensionModule` class with `encode()` that handles:
  - Extension point transformation (`addDistPathToAssets`)
  - Localization loading
  - Field passthrough (api_version, capabilities, supported_features, name, description, settings)

#### What needs to be added

The full module needs these additional capability methods. Each method should be ported directly from the old spec, changing only parameter types.

##### 6.1.1 validate()

Port `validateUIExtensionPointConfig()` from the old spec. This validates:
- Module files exist on disk
- No duplicate targets
- Tools/instructions files exist if referenced

```typescript
// In ui-extension.ts, add to the class:

async validate(
  config: UIExtensionToml,
  configPath: string,
  directory: string,
): Promise<Result<unknown, string>> {
  return validateUIExtensionPointConfig(directory, config.extension_points, configPath)
}
```

Port `validateUIExtensionPointConfig`, `checkForMissingPath`, and the `missingExtensionPointsMessage` constant into the module file.

##### 6.1.2 getBundleExtensionStdinContent()

Port from old spec. Generates esbuild stdin content from extension points. Handles Remote DOM extensions differently.

```typescript
getBundleExtensionStdinContent(config: UIExtensionToml): {main: string; assets?: Asset[]} {
  const shouldIncludeShopifyExtend = isRemoteDomExtension(config)
  const extensionPoints = config.extension_points || []

  const main = extensionPoints
    .map(({target, module}, index) => {
      if (shouldIncludeShopifyExtend) {
        return `import Target_${index} from '${module}';shopify.extend('${target}', (...args) => Target_${index}(...args));`
      }
      return `import '${module}';`
    })
    .join('\n')

  const assets: {[key: string]: Asset} = {}
  extensionPoints.forEach((extensionPoint) => {
    const shouldRenderAsset = buildShouldRenderAsset(extensionPoint, shouldIncludeShopifyExtend)
    if (shouldRenderAsset) {
      assets[AssetIdentifier.ShouldRender] = shouldRenderAsset
    }
  })

  const assetsArray = Object.values(assets)
  return {
    main,
    ...(assetsArray.length ? {assets: assetsArray} : {}),
  }
}
```

Port `isRemoteDomExtension`, `getShouldRenderTarget`, and `buildShouldRenderAsset` helper functions.

##### 6.1.3 copyStaticAssets()

Port from old spec. Copies static assets (tools, instructions) from source to output directory.

```typescript
async copyStaticAssets(
  config: UIExtensionToml,
  directory: string,
  outputPath: string,
): Promise<void> {
  if (!isRemoteDomExtension(config)) return

  await Promise.all(
    config.extension_points.flatMap((extensionPoint) => {
      if (!('build_manifest' in extensionPoint)) return []
      return Object.entries(extensionPoint.build_manifest.assets).map(([_, asset]) => {
        if (asset.static && asset.module) {
          const sourceFile = joinPath(directory, asset.module)
          const outputFilePath = joinPath(dirname(outputPath), asset.filepath)
          return copyFile(sourceFile, outputFilePath).catch((error) => {
            throw new Error(`Failed to copy static asset ${asset.module} to ${outputFilePath}: ${error.message}`)
          })
        }
        return Promise.resolve()
      })
    }),
  )
}
```

##### 6.1.4 contributeToSharedTypeFile()

This is the most complex method (~150 lines, 3-pass algorithm). Port the entire function body as-is from the old spec.

**Strategy:**
1. Move the entire `contributeToSharedTypeFile` function body from the old spec into the module.
2. Keep the helper imports from `type-generation.ts` (`findAllImportedFiles`, `createTypeDefinition`, `findNearestTsConfigDir`, `parseApiVersion`, `createToolsTypeDefinition`, `ToolsFileSchema`).
3. Change only the parameter types (`extension: ExtensionInstance` becomes broken down into `config`, `directory` etc.).

**Important:** This method accesses `extension.configuration`, `extension.directory`, and `extension.configuration.extension_points`. Map these to the new parameter types.

##### 6.1.5 hasExtensionPointTarget()

Simple lookup:

```typescript
hasExtensionPointTarget(config: UIExtensionToml, requestedTarget: string): boolean {
  return config.extension_points?.some((ep) => ep.target === requestedTarget) ?? false
}
```

#### Step-by-step approach

Because of the complexity, implement this in sub-steps:

1. **Verify the existing encode prototype still passes parity tests.** (Already done if Batch 1 passed.)

2. **Port helper functions** into the module file (or a dedicated `ui-extension-helpers.ts` if the file gets too long):
   - `addDistPathToAssets` (already in prototype)
   - `isRemoteDomExtension`
   - `getShouldRenderTarget`
   - `buildShouldRenderAsset`
   - `checkForMissingPath`
   - `validateUIExtensionPointConfig`

3. **Add each capability method one at a time**, running tests after each:
   - `validate()` -- test with missing module files, duplicate targets
   - `hasExtensionPointTarget()` -- trivial
   - `getBundleExtensionStdinContent()` -- test Remote DOM vs legacy, with/without should_render
   - `copyStaticAssets()` -- test static asset copying
   - `contributeToSharedTypeFile()` -- the big one. Port carefully. Test with existing ui_extension.test.ts cases.

4. **Write parity tests for each capability method.**

5. **Run existing spec tests to ensure no regression:**
   ```bash
   npx vitest run packages/app/src/cli/models/extensions/specifications/ui_extension.test.ts
   ```

**Note on these capability methods in Phase 2:** In Phase 2, these methods exist on the module but are NOT yet called by `ExtensionInstance`. The old spec's methods are still what `ExtensionInstance` calls. The parity tests validate that the new methods produce identical output, so when Phase 3 wires them up, behavior is guaranteed to be the same.

The exception is `encode()` -- that IS called through the `deployConfig()` routing in `extension-instance.ts` as soon as the module is registered. The other capability methods become active in Phase 3.

#### Register in index.ts

The `uiExtensionModule` is already registered. No changes needed for Phase 2.

---

## Section 7: Verification Checklist Per Module

For every module, before the PR is merged, verify ALL of the following:

### 7.1 Encode parity test passes

```bash
npx vitest run packages/app/src/cli/models/app/app-modules/<module>.test.ts
```

The test must call both `module.encode(config, ctx)` and `spec.deployConfig!(config, dir, apiKey, undefined)` with identical inputs and assert `expect(newResult).toEqual(oldResult)`.

### 7.2 Old spec tests still pass

```bash
npx vitest run packages/app/src/cli/models/extensions/specifications/<spec_file>.test.ts
```

The old spec file is not modified. Its tests must still pass. If they break, something is wrong with test mocking or import side effects.

### 7.3 Full test suite passes

```bash
npx vitest run packages/app/
```

No regressions in any app package test. Pay attention to:
- `extension-instance.test.ts` -- tests that exercise `deployConfig()` for this extension type
- Integration tests that do full deploy flows

### 7.4 Module registered in allAppModules

Verify in `packages/app/src/cli/models/app/app-modules/index.ts`:
- Module is imported
- Module is re-exported
- Module singleton is in the `allAppModules` array

### 7.5 deployConfig() routes through new module

This happens automatically. The routing logic in `extension-instance.ts` is:

```typescript
const appModule = allAppModules.find((mod) => mod.identifier === this.specification.identifier)
```

If the module's `identifier` matches the spec's `identifier`, Path 1 (AppModule encode) fires. To verify manually:

1. Add a `console.log` (or use debugger) in the `deployConfig()` method of `extension-instance.ts` at the start of Path 1.
2. Run a deploy with an extension of this type.
3. Confirm Path 1 is taken.
4. Remove the `console.log` before committing.

Alternatively, write an integration test that creates an `ExtensionInstance` with the spec and calls `deployConfig()`, then verifies the result matches expected output.

### 7.6 Summary table

| Module | File | Identifier | Batch | Key encode logic |
|--------|------|-----------|-------|-----------------|
| checkout_post_purchase | checkout-post-purchase.ts | `checkout_post_purchase` | 1 (done) | `metafields ?? []` |
| theme | theme.ts | `theme` | 1 | Static `{theme_extension: {files: {}}}` |
| channel_config | channel-config.ts | `channel_config` | 1 | Strip first-class fields, passthrough |
| checkout_ui_extension | checkout-ui.ts | `checkout_ui_extension` | 2 | Passthrough + `loadLocalesConfig` |
| web_pixel_extension | web-pixel.ts | `web_pixel_extension` | 2 | Rename `settings` -> `runtime_configuration_definition` |
| tax_calculation | tax-calculation.ts | `tax_calculation` | 2 | Unwrap `input.metafield_identifiers` |
| editor_extension_collection | editor-extension-collection.ts | `editor_extension_collection` | 2 | `inCollection` (post-Zod) + locales |
| function | function.ts | `function` | 3 (done) | File I/O, UUID, field restructuring |
| flow_action | flow-action.ts | `flow_action` | 3 | Renames + `serializeFields` + `loadSchemaFromPath` |
| flow_trigger | flow-trigger.ts | `flow_trigger` | 3 | Renames + `serializeFields` + `loadSchemaFromPath` |
| flow_template | flow-template.ts | `flow_template` | 3 | Template unwrap + `loadWorkflow` (base64) + locales |
| pos_ui_extension | pos-ui.ts | `pos_ui_extension` | 3 | `getDependencyVersion` for renderer_version |
| product_subscription | product-subscription.ts | `product_subscription` | 3 | `getDependencyVersion` (config ignored) |
| payments_extension | payments.ts | `payments_extension` | 4 | Switch on targeting, delegate to 6 variant functions |
| ui_extension | ui-extension.ts | `ui_extension` | 5 (done, encode) | Dist path prefix + locales + 5 capability methods |

### 7.7 Definition of Done for Phase 2

Phase 2 is complete when:

1. All 15 modules (14 non-config + channel_config) have dedicated AppModule subclasses.
2. All 15 modules are registered in `allAppModules`.
3. Every module's `encode()` has parity tests passing against the old `spec.deployConfig()`.
4. `ui_extension` has parity tests for all 5 additional capability methods.
5. All existing tests pass (old spec tests, extension-instance tests, integration tests).
6. The full CI pipeline is green.
7. No new runtime dependencies are introduced.
8. Old spec files are untouched (they are deleted in Phase 4).

### 7.8 Dev Mode Parity Testing

#### Background

The AppModule base class defines three dev-mode methods: `patchForDev()`, `devMessages()`, and `getDevProcess()`. These methods are part of the end-state architecture but are NOT wired into the dev flow during Phase 2. During Phase 2, `ExtensionInstance` still delegates dev-mode behavior to the old spec's `patchWithAppDevURLs` and `getDevSessionUpdateMessages` callbacks.

However, several Phase 2 modules implement overrides for these methods. Even though the overrides are not yet active in the runtime, their output must be tested for parity now so that Phase 3 wiring is guaranteed to be behavior-preserving.

#### Which modules need dev-mode parity tests

The following modules override dev-mode methods and must have parity tests added alongside their encode parity tests in Phase 2:

| Module | Method | Old spec callback to match |
|--------|--------|---------------------------|
| `appAccessModule` | `patchForDev()` | `app_config_app_access.ts` `patchWithAppDevURLs` |
| `appProxyModule` | `patchForDev()` | `app_config_app_proxy.ts` `patchWithAppDevURLs` |
| `appHomeModule` | `patchForDev()` | `app_config_app_home.ts` `patchWithAppDevURLs` |
| `appAccessModule` | `devMessages()` | `app_config_app_access.ts` `getDevSessionUpdateMessages` |

#### How to write dev-mode parity tests

The pattern mirrors the encode parity tests. For each method:

1. Construct the same input configuration.
2. Call the new module method (e.g., `appAccessModule.patchForDev(config, context)`).
3. Call the old spec callback (e.g., `appAccessSpec.patchWithAppDevURLs!(config, ...)`) with identical inputs.
4. Assert that the outputs are deeply equal.

Example structure:

```typescript
describe('AppAccessModule patchForDev parity', () => {
  test('matches old spec patchWithAppDevURLs output', async () => {
    const config = { /* representative config */ }
    const devContext = { /* dev URL, port, etc. */ }

    const newResult = await appAccessModule.patchForDev(config, devContext)
    const oldResult = await appAccessSpec.patchWithAppDevURLs!(config, /* old params */)

    expect(newResult).toEqual(oldResult)
  })
})

describe('AppAccessModule devMessages parity', () => {
  test('matches old spec getDevSessionUpdateMessages output', async () => {
    const config = { /* representative config */ }

    const newResult = appAccessModule.devMessages(config, /* context */)
    const oldResult = appAccessSpec.getDevSessionUpdateMessages!(config, /* old params */)

    expect(newResult).toEqual(oldResult)
  })
})
```

#### Why test now instead of in Phase 3

Testing dev-mode parity in Phase 2 (even though the methods are not yet wired in) provides two benefits:

1. **Early signal:** If the parity test fails, the bug is found while the module is being written, not during the Phase 3 wiring PR where the root cause would be harder to isolate.
2. **Safe Phase 3 wiring:** When Phase 3 switches `ExtensionInstance` to call the module's dev methods instead of the spec's callbacks, the parity tests already prove the output is identical. The Phase 3 PR becomes a pure wiring change with no logic risk.
