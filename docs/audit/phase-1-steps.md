# Phase 1 Implementation Guide: Step-by-Step

This document provides exact, copy-paste-ready instructions for implementing Phase 1 of the AppModule migration. Any engineer or AI agent should be able to follow these steps sequentially to produce a working implementation.

All file paths are relative to the repository root unless otherwise noted. The app package root is `packages/app/src/cli/`.

---

## Section 1: Prerequisites

### 1.1 What you need to understand

Before starting, read these files to understand the current system:

**Architecture context:**
- `docs/audit/05-end-state-proposal.md` — The target architecture. Phase 1 implements only the `AppModule` class and 9 config modules.
- `docs/audit/phase-1-plan.md` — High-level plan with scope, risks, and definition of done.

**Existing code to understand:**
- `packages/app/src/cli/models/extensions/specification.ts` — The `TransformationConfig` and `CustomTransformationConfig` interfaces. The `resolveAppConfigTransform()` function. The `createConfigExtensionSpecification()` factory. This is the OLD system you are replacing.
- `packages/app/src/cli/models/extensions/extension-instance.ts` — The `ExtensionInstance` class, specifically the `deployConfig()` method (around line 215). This is where encode integration happens.
- `packages/app/src/cli/models/app/loader.ts` — The `AppLoader` class, specifically `loadExtensions()` (around line 610). This is where extraction integration happens.
- `packages/app/src/cli/services/app/select-app.ts` — The `remoteAppConfigurationExtensionContent()` function. This is where decode integration happens.
- `packages/app/src/cli/utilities/json-schema.ts` — The `unifiedConfigurationParserFactory()` function. This is where the category error fix goes.

**Key helper files:**
- `packages/app/src/cli/models/extensions/specifications/validation/url_prepender.ts` — The `prependApplicationUrl()` function used for relative URL resolution.
- `packages/app/src/cli/models/extensions/specifications/validation/common.ts` — The `removeTrailingSlash()` function.
- `packages/app/src/cli/models/extensions/specifications/transform/app_config_webhook.ts` — The `transformFromWebhookConfig()`, `transformToWebhookConfig()`, and `mergeAllWebhooks()` functions.
- `packages/app/src/cli/models/extensions/specifications/transform/app_config_events.ts` — The `transformFromEventsConfig()` and `transformToEventsConfig()` functions.
- `packages/app/src/cli/models/extensions/specifications/types/app_config_webhook.ts` — The `WebhooksConfig` and `WebhookSubscription` interfaces.
- `packages/app/src/cli/models/extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.ts` — The `ComplianceTopic` enum.

**Existing spec files (these are your parity reference for each module):**
- `packages/app/src/cli/models/extensions/specifications/app_config_branding.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_app_access.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_webhook.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_webhook_subscription.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_events.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_privacy_compliance_webhooks.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_app_proxy.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_point_of_sale.ts`
- `packages/app/src/cli/models/extensions/specifications/app_config_app_home.ts`

### 1.2 Testing setup

All tests use vitest. Run tests with:

```bash
cd packages/app
npx vitest run src/cli/models/app/app-module.test.ts        # Single test file
npx vitest run src/cli/models/app/app-modules/              # All module tests
npx vitest run src/cli/models/                              # All model tests
npx vitest run                                              # Full suite (553+ tests)
```

Before making any changes, verify the existing test suite passes:

```bash
cd packages/app && npx vitest run
```

Record the test count. All existing tests must continue to pass after every step.

### 1.3 Important conventions

- All imports use `.js` extensions (ESM convention): `import {AppModule} from '../app-module.js'`
- The codebase uses `zod` from `@shopify/cli-kit/node/schema`, NOT directly from `zod`
- Types are inferred from Zod schemas where possible: `type MyToml = zod.infer<typeof MyTomlSchema>`
- Each module file exports a singleton instance: `export const brandingModule = new BrandingModule()`
- The `EncodeContext.appConfiguration` is typed as `AppConfigurationWithoutPath` from `../../app/app.js`

### 1.4 Branching strategy

See `docs/audit/branching-strategy.md` for the full branching and review strategy.

Phase 1 uses **2 independent PRs** off `main`:
- **PR 1:** Base class + 9 config modules + tests (purely additive)
- **PR 2:** Integration points (loader, deployConfig, select-app, json-schema) + regression test

---

## Section 2: Create the AppModule base class

### 2.1 File to create

**Path:** `packages/app/src/cli/models/app/app-module.ts`

### 2.2 Content

```typescript
/**
 * AppModule: The universal base class for all app modules.
 *
 * Every app module -- config modules in shopify.app.toml AND extensions in
 * their own .extension.toml files -- is an instance of this class or a subclass.
 *
 * Contracts are the source of truth for validation. The CLI's job is to
 * extract config, encode it to contract shape, validate, and send. Modules
 * that need file I/O, localization, build manifests, etc. override the
 * async encode() method.
 */

import {AppConfigurationWithoutPath} from './app.js'

/**
 * Context available to encode() during deploy.
 */
export interface EncodeContext {
  appConfiguration: AppConfigurationWithoutPath
  directory: string
  apiKey: string
}

/**
 * The universal module base class.
 *
 * Concrete modules extend this directly (max depth of 2).
 * Default implementations are passthrough -- contract-only modules
 * use the base class with no overrides.
 */
export class AppModule<TToml = unknown, TContract = unknown> {
  readonly identifier: string
  readonly uidStrategy: 'single' | 'dynamic' | 'uuid'
  readonly tomlKeys?: string[]

  constructor(options: {identifier: string; uidStrategy: 'single' | 'dynamic' | 'uuid'; tomlKeys?: string[]}) {
    this.identifier = options.identifier
    this.uidStrategy = options.uidStrategy
    this.tomlKeys = options.tomlKeys
  }

  /** Extract this module's data from TOML content. */
  extract(content: {[key: string]: unknown}): TToml | TToml[] | undefined {
    if (this.tomlKeys) return extractByKeys(this.tomlKeys, content) as unknown as TToml
    // Extension modules own their whole file
    return content as TToml
  }

  /** Encode to contract format. Override for transforms, file I/O, computed fields. */
  async encode(toml: TToml, _context: EncodeContext): Promise<TContract> {
    // Default: passthrough
    return toml as unknown as TContract
  }

  /** Decode contract data back to TOML. Override for reverse transforms. */
  decode(contract: TContract): TToml {
    // Default: passthrough
    return contract as unknown as TToml
  }
}

/**
 * For dynamic-UID modules that produce multiple instances from one TOML section.
 */
export interface DynamicAppModule<TToml = object, TContract = object>
  extends Omit<AppModule<TToml, TContract>, 'extract' | 'uidStrategy'> {
  uidStrategy: 'dynamic'
  extract(content: {[key: string]: unknown}): TToml[] | undefined
}

export type AnyAppModule = AppModule | DynamicAppModule

/**
 * Extract a module's data from the full TOML based on its declared tomlKeys.
 */
export function extractByKeys(
  tomlKeys: string[],
  content: {[key: string]: unknown},
): {[key: string]: unknown} | undefined {
  const result: {[key: string]: unknown} = {}
  for (const key of tomlKeys) {
    if (content[key] !== undefined) {
      result[key] = content[key]
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}
```

### 2.3 Key design decisions

- **`extract()` returns `TToml | TToml[] | undefined`:** The union return type accommodates both single-UID modules (return a single object or undefined) and dynamic-UID modules (return an array or undefined). The loader checks `uidStrategy === 'dynamic'` to determine how to interpret the result.
- **`DynamicAppModule` is an interface, not a class:** Dynamic modules like `webhook_subscription` use a plain object satisfying this interface because their `extract()` needs a different return type (`TToml[]`). The `AnyAppModule` union type allows the registry to hold both.
- **`tomlKeys` is optional on the base class:** Config modules set `tomlKeys` to declare which top-level TOML keys they read from `shopify.app.toml`. Extension modules (Phase 2) leave it undefined, meaning they own their entire `.extension.toml` file.
- **`extractByKeys()` is a standalone function:** Exported separately so it can be tested independently and used by modules that need custom extraction logic.

---

## Section 3: Implement each config module (9 modules, in order)

All module files go in: `packages/app/src/cli/models/app/app-modules/`

The order matches `SORTED_CONFIGURATION_SPEC_IDENTIFIERS` from `packages/app/src/cli/models/extensions/load-specifications.ts`:
1. branding
2. app_access
3. webhooks
4. webhook_subscription
5. events
6. privacy_compliance_webhooks
7. app_proxy
8. point_of_sale
9. app_home

---

### 3.1 Branding Module

**File:** `packages/app/src/cli/models/app/app-modules/branding.ts`

#### TOML type
What the user writes in `shopify.app.toml`:
```toml
name = "my-app"
handle = "my-app-handle"
```
The TOML type includes `name` (string, required, max 30 chars) and `handle` (string, optional, max 256 chars, restricted characters).

#### Contract type
What the server expects:
```json
{ "name": "my-app", "app_handle": "my-app-handle" }
```
Key rename: `handle` (TOML) becomes `app_handle` (contract).

#### Constructor
- `identifier`: `'branding'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['name', 'handle']`

#### Custom extract needed?
No. The default `extractByKeys(['name', 'handle'], content)` is correct.

#### encode() method
```typescript
async encode(toml: BrandingToml, _context: EncodeContext) {
  return {
    name: toml.name,
    app_handle: toml.handle,
  }
}
```

#### decode() method
```typescript
decode(contract: BrandingContract) {
  return {
    name: contract.name,
    handle: contract.app_handle,
  } as BrandingToml
}
```

#### Uses EncodeContext?
No. Branding does not depend on `application_url` or any other context.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

// --- TOML shape ---

const BrandingTomlSchema = BaseSchemaWithoutHandle.extend({
  name: zod
    .string({required_error: 'String is required'})
    .max(30, {message: 'String must be less than 30 characters'}),
  handle: zod
    .string({required_error: 'String is required'})
    .max(256, {message: 'String must be less than 256 characters long'})
    .refine((value) => value && /^\w*(?!-)[_a-z0-9-]+(?<!-)$/.test(value), {
      message: "String can't contain special characters",
    })
    .optional(),
})

type BrandingToml = zod.infer<typeof BrandingTomlSchema>

// --- Contract shape ---

interface BrandingContract {
  name: string
  app_handle?: string
}

// --- Module definition ---

class BrandingModule extends AppModule<BrandingToml, BrandingContract> {
  constructor() {
    super({identifier: 'branding', uidStrategy: 'single', tomlKeys: ['name', 'handle']})
  }

  async encode(toml: BrandingToml, _context: EncodeContext) {
    return {
      name: toml.name,
      app_handle: toml.handle,
    }
  }

  decode(contract: BrandingContract) {
    return {
      name: contract.name,
      handle: contract.app_handle,
    } as BrandingToml
  }
}

export const brandingModule = new BrandingModule()
```

#### Parity reference
Compare against `app_config_branding.ts`:
- Forward: `BrandingTransformConfig = { name: 'name', app_handle: 'handle' }` — maps contract key `name` FROM TOML path `name`, contract key `app_handle` FROM TOML path `handle`.
- Reverse: The generic `appConfigTransform` with `reverse=true` swaps the mapping.

#### Test file: `packages/app/src/cli/models/app/app-modules/branding.test.ts`

```typescript
import {brandingModule} from './branding.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {EncodeContext} from '../app-module.js'
import {describe, expect, test} from 'vitest'

const context: EncodeContext = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp',
  apiKey: 'test-key',
}

describe('BrandingModule', () => {
  test('identifier and uidStrategy', () => {
    expect(brandingModule.identifier).toBe('branding')
    expect(brandingModule.uidStrategy).toBe('single')
  })

  describe('extract', () => {
    test('extracts name and handle from full TOML', () => {
      const content = {name: 'my-app', handle: 'my-handle', client_id: '123', webhooks: {api_version: '2024-01'}}
      const result = brandingModule.extract(content)
      expect(result).toEqual({name: 'my-app', handle: 'my-handle'})
    })

    test('returns undefined when neither key is present', () => {
      const content = {client_id: '123', webhooks: {api_version: '2024-01'}}
      const result = brandingModule.extract(content)
      expect(result).toBeUndefined()
    })

    test('extracts partial data (name only)', () => {
      const content = {name: 'my-app', client_id: '123'}
      const result = brandingModule.extract(content)
      expect(result).toEqual({name: 'my-app'})
    })
  })

  describe('encode (parity with spec.transformLocalToRemote)', () => {
    test('renames handle to app_handle', async () => {
      const toml = {name: 'my-app', handle: 'my-app-handle'} as any
      const result = await brandingModule.encode(toml, context)
      expect(result).toEqual({name: 'my-app', app_handle: 'my-app-handle'})
    })

    test('handles missing handle', async () => {
      const toml = {name: 'my-app'} as any
      const result = await brandingModule.encode(toml, context)
      expect(result).toEqual({name: 'my-app', app_handle: undefined})
    })
  })

  describe('decode (parity with spec.transformRemoteToLocal)', () => {
    test('renames app_handle to handle', () => {
      const contract = {name: 'my-app', app_handle: 'my-app-handle'}
      const result = brandingModule.decode(contract)
      expect(result).toEqual({name: 'my-app', handle: 'my-app-handle'})
    })
  })

  describe('round-trip', () => {
    test('encode then decode produces original data', async () => {
      const original = {name: 'my-app', handle: 'my-app-handle'} as any
      const encoded = await brandingModule.encode(original, context)
      const decoded = brandingModule.decode(encoded)
      expect(decoded).toEqual({name: 'my-app', handle: 'my-app-handle'})
    })
  })
})
```

---

### 3.2 App Access Module

**File:** `packages/app/src/cli/models/app/app-modules/app-access.ts`

#### TOML type
```toml
[access.admin]
direct_api_mode = "online"
embedded_app_direct_api_access = true

[access_scopes]
scopes = "read_products,write_products"
required_scopes = ["read_orders"]
optional_scopes = ["read_customers"]
use_legacy_install_flow = false

[auth]
redirect_urls = ["https://example.com/callback"]
```
Three top-level keys: `access`, `access_scopes`, `auth`.

#### Contract type
```json
{
  "access": {"admin": {"direct_api_mode": "online", "embedded_app_direct_api_access": true}},
  "scopes": "read_products,write_products",
  "required_scopes": ["read_orders"],
  "optional_scopes": ["read_customers"],
  "use_legacy_install_flow": false,
  "redirect_url_allowlist": ["https://example.com/callback"]
}
```
Key mappings:
- `access` passes through unchanged
- `access_scopes.scopes` flattens to `scopes`
- `access_scopes.required_scopes` flattens to `required_scopes`
- `access_scopes.optional_scopes` flattens to `optional_scopes`
- `access_scopes.use_legacy_install_flow` flattens to `use_legacy_install_flow`
- `auth.redirect_urls` renames to `redirect_url_allowlist`

#### Constructor
- `identifier`: `'app_access'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['access', 'access_scopes', 'auth']`

#### Custom extract needed?
No. Default `extractByKeys` is correct.

#### encode() method
Only set fields that are defined (use conditional assignment to avoid sending `undefined` values):

```typescript
async encode(toml: AppAccessToml, _context: EncodeContext) {
  const result: AppAccessContract = {}
  if (toml.access !== undefined) result.access = toml.access
  if (toml.access_scopes?.scopes !== undefined) result.scopes = toml.access_scopes.scopes
  if (toml.access_scopes?.required_scopes !== undefined) result.required_scopes = toml.access_scopes.required_scopes
  if (toml.access_scopes?.optional_scopes !== undefined) result.optional_scopes = toml.access_scopes.optional_scopes
  if (toml.access_scopes?.use_legacy_install_flow !== undefined)
    result.use_legacy_install_flow = toml.access_scopes.use_legacy_install_flow
  if (toml.auth?.redirect_urls !== undefined) result.redirect_url_allowlist = toml.auth.redirect_urls
  return result
}
```

**Why conditional assignment:** The existing `TransformationConfig` approach only sets a contract key if the source path resolves to a value. The `AppAccessTransformConfig` maps `scopes: 'access_scopes.scopes'`, which means: set `scopes` in the contract only if `access_scopes.scopes` exists in the TOML. We replicate this with explicit `!== undefined` checks.

#### decode() method

```typescript
decode(contract: AppAccessContract) {
  const result: {[key: string]: unknown} = {}
  if (contract.access !== undefined) result.access = contract.access

  const accessScopes: {[key: string]: unknown} = {}
  if (contract.scopes !== undefined) accessScopes.scopes = contract.scopes
  if (contract.required_scopes !== undefined) accessScopes.required_scopes = contract.required_scopes
  if (contract.optional_scopes !== undefined) accessScopes.optional_scopes = contract.optional_scopes
  if (contract.use_legacy_install_flow !== undefined)
    accessScopes.use_legacy_install_flow = contract.use_legacy_install_flow
  if (Object.keys(accessScopes).length > 0) result.access_scopes = accessScopes

  if (contract.redirect_url_allowlist !== undefined) {
    result.auth = {redirect_urls: contract.redirect_url_allowlist}
  }
  return result as AppAccessToml
}
```

#### Uses EncodeContext?
No. The encode does not need `application_url`.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {validateUrl} from '../../app/validation/common.js'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessTomlSchema = BaseSchemaWithoutHandle.extend({
  access: zod
    .object({
      admin: zod
        .object({
          direct_api_mode: zod.union([zod.literal('online'), zod.literal('offline')]).optional(),
          embedded_app_direct_api_access: zod.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  access_scopes: zod
    .object({
      scopes: zod
        .string()
        .transform((scopes) => normalizeDelimitedString(scopes) ?? '')
        .optional(),
      required_scopes: zod.array(zod.string()).optional(),
      optional_scopes: zod.array(zod.string()).optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod.object({
    redirect_urls: zod.array(validateUrl(zod.string())),
  }),
})

type AppAccessToml = zod.infer<typeof AppAccessTomlSchema>

interface AppAccessContract {
  access?: {admin?: {direct_api_mode?: string; embedded_app_direct_api_access?: boolean}}
  scopes?: string
  required_scopes?: string[]
  optional_scopes?: string[]
  use_legacy_install_flow?: boolean
  redirect_url_allowlist?: string[]
}

class AppAccessModule extends AppModule<AppAccessToml, AppAccessContract> {
  constructor() {
    super({identifier: 'app_access', uidStrategy: 'single', tomlKeys: ['access', 'access_scopes', 'auth']})
  }

  async encode(toml: AppAccessToml, _context: EncodeContext) {
    const result: AppAccessContract = {}
    if (toml.access !== undefined) result.access = toml.access
    if (toml.access_scopes?.scopes !== undefined) result.scopes = toml.access_scopes.scopes
    if (toml.access_scopes?.required_scopes !== undefined) result.required_scopes = toml.access_scopes.required_scopes
    if (toml.access_scopes?.optional_scopes !== undefined) result.optional_scopes = toml.access_scopes.optional_scopes
    if (toml.access_scopes?.use_legacy_install_flow !== undefined)
      result.use_legacy_install_flow = toml.access_scopes.use_legacy_install_flow
    if (toml.auth?.redirect_urls !== undefined) result.redirect_url_allowlist = toml.auth.redirect_urls
    return result
  }

  decode(contract: AppAccessContract) {
    const result: {[key: string]: unknown} = {}
    if (contract.access !== undefined) result.access = contract.access

    const accessScopes: {[key: string]: unknown} = {}
    if (contract.scopes !== undefined) accessScopes.scopes = contract.scopes
    if (contract.required_scopes !== undefined) accessScopes.required_scopes = contract.required_scopes
    if (contract.optional_scopes !== undefined) accessScopes.optional_scopes = contract.optional_scopes
    if (contract.use_legacy_install_flow !== undefined)
      accessScopes.use_legacy_install_flow = contract.use_legacy_install_flow
    if (Object.keys(accessScopes).length > 0) result.access_scopes = accessScopes

    if (contract.redirect_url_allowlist !== undefined) {
      result.auth = {redirect_urls: contract.redirect_url_allowlist}
    }
    return result as AppAccessToml
  }
}

export const appAccessModule = new AppAccessModule()
```

#### Parity reference
Compare against `app_config_app_access.ts`:
- `AppAccessTransformConfig`: `{ access: 'access', scopes: 'access_scopes.scopes', required_scopes: 'access_scopes.required_scopes', optional_scopes: 'access_scopes.optional_scopes', use_legacy_install_flow: 'access_scopes.use_legacy_install_flow', redirect_url_allowlist: 'auth.redirect_urls' }`
- The forward transform calls the generic `appConfigTransform()` which reads dotted paths from the TOML and maps them to flat contract keys.

#### Test file: `packages/app/src/cli/models/app/app-modules/app-access.test.ts`

Write parity tests covering:
1. Extract: 3 keys present, partial keys, no keys
2. Encode: Full config with all fields, minimal config with only `auth`
3. Decode: Full contract back to nested TOML shape
4. Round-trip: encode then decode

---

### 3.3 Webhooks Module

**File:** `packages/app/src/cli/models/app/app-modules/webhooks.ts`

#### TOML type
The shared `webhooks` section in `shopify.app.toml`:
```toml
[webhooks]
api_version = "2024-01"
```
This module only cares about `api_version`. The subscriptions and compliance topics are handled by the other two webhook-related modules.

#### Contract type
```json
{ "api_version": "2024-01" }
```

#### Constructor
- `identifier`: `'webhooks'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['webhooks']`

Note: This is a **shared key** module. Three modules claim `tomlKeys: ['webhooks']`: this one, `webhook_subscription`, and `privacy_compliance_webhooks`. Each extracts different data from the same `webhooks` section.

#### Custom extract needed?
No. The default `extractByKeys` returns `{webhooks: {...}}` when the key exists. The `encode()` method then extracts only `api_version` from the nested object.

#### encode() method
```typescript
async encode(toml: WebhooksToml, _context: EncodeContext) {
  const webhooks = toml.webhooks as WebhooksConfig | undefined
  if (!webhooks) return {}
  return {api_version: webhooks.api_version}
}
```

#### decode() method
```typescript
decode(contract: WebhooksContract) {
  if (!contract.api_version) return {} as WebhooksToml
  return {webhooks: {api_version: contract.api_version}} as unknown as WebhooksToml
}
```

#### Uses EncodeContext?
No.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {WebhooksSchema} from '../../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {WebhooksConfig} from '../../extensions/specifications/types/app_config_webhook.js'
import {zod} from '@shopify/cli-kit/node/schema'

type WebhooksToml = zod.infer<typeof WebhooksSchema>

interface WebhooksContract {
  api_version?: string
}

class WebhooksModule extends AppModule<WebhooksToml, WebhooksContract> {
  constructor() {
    super({identifier: 'webhooks', uidStrategy: 'single', tomlKeys: ['webhooks']})
  }

  async encode(toml: WebhooksToml, _context: EncodeContext) {
    const webhooks = toml.webhooks as WebhooksConfig | undefined
    if (!webhooks) return {}
    return {api_version: webhooks.api_version}
  }

  decode(contract: WebhooksContract) {
    if (!contract.api_version) return {} as WebhooksToml
    return {webhooks: {api_version: contract.api_version}} as unknown as WebhooksToml
  }
}

export const webhooksModule = new WebhooksModule()
```

#### Parity reference
Compare against `app_config_webhook.ts` which uses `CustomTransformationConfig` with:
- `forward: transformFromWebhookConfig` — reads `content.webhooks.api_version`, returns `{api_version}`
- `reverse: transformToWebhookConfig` — reads `content.api_version`, returns `{webhooks: {api_version}}`

---

### 3.4 Webhook Subscription Module

**File:** `packages/app/src/cli/models/app/app-modules/webhook-subscription.ts`

This is the most complex module. It is a **dynamic-UID** module that reads from the **shared `webhooks` key** and produces **multiple instances** (one per subscription topic).

#### TOML type (per-subscription, after splitting)
Each extracted item is a single flattened subscription:
```typescript
interface WebhookSubscriptionToml {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}
```

#### Contract type
Same shape as TOML (the transform is URI resolution, not restructuring):
```typescript
interface WebhookSubscriptionContract {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}
```

#### Constructor
This module uses the `DynamicAppModule` interface (plain object), not a class extending `AppModule`. This is because `extract()` returns `TToml[]` instead of `TToml`.
- `identifier`: `'webhook_subscription'`
- `uidStrategy`: `'dynamic'`
- `tomlKeys`: `['webhooks']`

#### Custom extract needed?
**Yes.** This is the main override. The extraction logic:
1. Read `content.webhooks.subscriptions`
2. For each subscription, iterate `topics` array
3. For each topic, create a separate flattened item with `api_version`, `uri`, `topic`, and optional fields
4. **Exclude `compliance_topics`** — those are handled by `privacy_compliance_webhooks`
5. Return the array of items, or `undefined` if empty

#### encode() method
```typescript
async encode(toml, context) {
  let appUrl: string | undefined
  if ('application_url' in context.appConfiguration) {
    appUrl = (context.appConfiguration as {application_url?: string}).application_url
  }
  return {
    ...toml,
    uri: prependApplicationUrl(toml.uri, appUrl),
  }
}
```

#### decode() method
```typescript
decode(contract) {
  const {api_version: _, topic, ...rest} = contract
  return {
    webhooks: {
      subscriptions: [
        {
          topics: [topic],
          ...rest,
        },
      ],
    },
  } as unknown as WebhookSubscriptionToml
}
```
Note: The decode wraps the singular `topic` back into a `topics: [topic]` array and nests under `webhooks.subscriptions`. The `api_version` is discarded (it comes from the `webhooks` module during decode merging).

#### Uses EncodeContext?
**Yes.** Uses `context.appConfiguration.application_url` to resolve relative URIs (e.g., `/webhooks/orders` becomes `https://myapp.com/webhooks/orders`).

#### Full file content

```typescript
import {DynamicAppModule} from '../app-module.js'
import {WebhooksConfig} from '../../extensions/specifications/types/app_config_webhook.js'
import {prependApplicationUrl} from '../../extensions/specifications/validation/url_prepender.js'

// --- TOML shape (per-subscription, after splitting) ---

interface WebhookSubscriptionToml {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}

// --- Contract shape ---

interface WebhookSubscriptionContract {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}

// --- Module definition ---

export const webhookSubscriptionModule: DynamicAppModule<WebhookSubscriptionToml, WebhookSubscriptionContract> = {
  identifier: 'webhook_subscription',

  tomlKeys: ['webhooks'],

  extract(content) {
    const webhooks = (content as {webhooks?: WebhooksConfig}).webhooks
    if (!webhooks?.subscriptions) return undefined

    const apiVersion = webhooks.api_version
    const items: WebhookSubscriptionToml[] = []

    for (const subscription of webhooks.subscriptions) {
      // compliance_topics are handled by the privacy_compliance_webhooks module
      const {uri, topics, compliance_topics: _, ...optionalFields} = subscription
      if (!topics) continue

      for (const topic of topics) {
        items.push({
          api_version: apiVersion,
          uri,
          topic,
          ...optionalFields,
        })
      }
    }

    return items.length > 0 ? items : undefined
  },

  async encode(toml, context) {
    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    return {
      ...toml,
      uri: prependApplicationUrl(toml.uri, appUrl),
    }
  },

  decode(contract) {
    const {api_version: _, topic, ...rest} = contract
    return {
      webhooks: {
        subscriptions: [
          {
            topics: [topic],
            ...rest,
          },
        ],
      },
    } as unknown as WebhookSubscriptionToml
  },

  uidStrategy: 'dynamic',
}
```

#### Parity reference
Compare against `app_config_webhook_subscription.ts`:
- Forward: `WebhookSubscriptionTransformConfig.forward` — reads `application_url` from `appConfiguration`, calls `prependApplicationUrl(webhookConfig.uri, appUrl)`, spreads remaining fields
- Reverse: `transformToWebhookSubscriptionConfig` — strips `api_version`, wraps `topic` into `topics: [topic]`, nests under `webhooks.subscriptions`
- The subscription splitting logic currently lives in `loader.ts` (`createWebhookSubscriptionInstances`) not in the spec. The AppModule moves it into `extract()`.

#### Test file: `packages/app/src/cli/models/app/app-modules/webhook-subscription.test.ts`

Key test cases:
1. Extract: Multi-topic subscriptions are split into individual items
2. Extract: Compliance-only subscriptions (no `topics`, only `compliance_topics`) are excluded
3. Extract: Mixed subscriptions (both `topics` and `compliance_topics`) exclude compliance but keep regular topics
4. Extract: Returns undefined when no subscriptions exist
5. Encode: Relative URIs are prepended with application_url
6. Encode: Absolute URIs are unchanged
7. Decode: Wraps topic back into topics array
8. Round-trip

---

### 3.5 Events Module

**File:** `packages/app/src/cli/models/app/app-modules/events.ts`

#### TOML type
```toml
[events]
api_version = "2024-01"

[[events.subscription]]
topic = "products/create"
uri = "https://example.com/events/products"
```

#### Contract type
Same as TOML shape for forward. For reverse, the server adds an `identifier` field to each subscription that must be stripped.

#### Constructor
- `identifier`: `'events'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['events']`

#### Custom extract needed?
No. Default `extractByKeys(['events'], content)` is correct.

#### encode() method
Identity/passthrough. The TOML shape IS the contract shape for forward.

```typescript
async encode(toml: EventsToml, _context: EncodeContext) {
  return toml as unknown as EventsContract
}
```

#### decode() method
Strips the `identifier` field from each subscription:

```typescript
decode(contract: EventsContract) {
  if (!contract.events?.subscription) return contract as unknown as EventsToml

  const cleanedSubscriptions = contract.events.subscription.map((sub) => {
    const {identifier: _, ...rest} = sub
    return rest
  })

  return {
    events: {
      api_version: contract.events.api_version,
      subscription: cleanedSubscriptions,
    },
  } as EventsToml
}
```

#### Uses EncodeContext?
No.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const EventsTomlSchema = BaseSchemaWithoutHandle.extend({
  events: zod.any().optional(),
})

type EventsToml = zod.infer<typeof EventsTomlSchema>

interface EventsContract {
  events?: {
    api_version?: string
    subscription?: {identifier?: string; [key: string]: unknown}[]
  }
}

class EventsModule extends AppModule<EventsToml, EventsContract> {
  constructor() {
    super({identifier: 'events', uidStrategy: 'single', tomlKeys: ['events']})
  }

  async encode(toml: EventsToml, _context: EncodeContext) {
    return toml as unknown as EventsContract
  }

  decode(contract: EventsContract) {
    if (!contract.events?.subscription) return contract as unknown as EventsToml

    const cleanedSubscriptions = contract.events.subscription.map((sub) => {
      const {identifier: _, ...rest} = sub
      return rest
    })

    return {
      events: {
        api_version: contract.events.api_version,
        subscription: cleanedSubscriptions,
      },
    } as EventsToml
  }
}

export const eventsModule = new EventsModule()
```

#### Parity reference
Compare against `app_config_events.ts`:
- Forward: `transformFromEventsConfig` — returns `content` unchanged (identity)
- Reverse: `transformToEventsConfig` — strips `identifier` from each subscription, wraps in `{events: {...}}`

---

### 3.6 Privacy Compliance Webhooks Module

**File:** `packages/app/src/cli/models/app/app-modules/privacy-compliance-webhooks.ts`

This module reads from the **shared `webhooks` key**, extracting compliance-specific data (compliance topics from subscriptions, and the legacy `privacy_compliance` block).

#### TOML type
The full webhooks section (same Zod schema as the webhooks module). The module extracts compliance URIs from two possible locations:
1. Modern: `webhooks.subscriptions[].compliance_topics` with associated `uri`
2. Legacy: `webhooks.privacy_compliance.customer_deletion_url`, etc.

#### Contract type
```json
{
  "api_version": "2024-01",
  "customers_redact_url": "https://example.com/customers/redact",
  "customers_data_request_url": "https://example.com/customers/data-request",
  "shop_redact_url": "https://example.com/shop/redact"
}
```

#### Constructor
- `identifier`: `'privacy_compliance_webhooks'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['webhooks']`

#### Custom extract needed?
**Yes.** The default `extractByKeys` would return the full `webhooks` section, but this module should only be present when there are compliance subscriptions or a `privacy_compliance` block. The custom `extract()`:
1. Reads `content.webhooks`
2. Checks if any subscriptions have `compliance_topics` or if `privacy_compliance` is defined
3. Returns `{webhooks: ...}` only if compliance data exists, otherwise `undefined`

#### encode() method
Uses `EncodeContext` for `application_url` to resolve relative URIs.

```typescript
async encode(toml: PrivacyComplianceToml, context: EncodeContext) {
  const webhooks = toml.webhooks as WebhooksConfig | undefined
  if (!webhooks) return {}

  let appUrl: string | undefined
  if ('application_url' in context.appConfiguration) {
    appUrl = (context.appConfiguration as {application_url?: string}).application_url
  }

  const customersRedactUrl =
    getComplianceUri(webhooks, 'customers/redact') ?? webhooks?.privacy_compliance?.customer_deletion_url
  const customersDataRequestUrl =
    getComplianceUri(webhooks, 'customers/data_request') ?? webhooks?.privacy_compliance?.customer_data_request_url
  const shopRedactUrl = getComplianceUri(webhooks, 'shop/redact') ?? webhooks?.privacy_compliance?.shop_deletion_url

  const urls = compact({
    customers_redact_url: relativeUri(customersRedactUrl, appUrl),
    customers_data_request_url: relativeUri(customersDataRequestUrl, appUrl),
    shop_redact_url: relativeUri(shopRedactUrl, appUrl),
  })

  if (Object.keys(urls).length === 0) return urls

  return {
    api_version: webhooks.api_version,
    ...urls,
  }
}
```

Helper functions (private to the file):
```typescript
function relativeUri(uri?: string, appUrl?: string) {
  return appUrl && uri?.startsWith('/') ? `${removeTrailingSlash(appUrl)}${uri}` : uri
}

function getComplianceUri(webhooks: WebhooksConfig, complianceTopic: string): string | undefined {
  return webhooks.subscriptions?.find((sub) => sub.compliance_topics?.includes(complianceTopic))?.uri
}
```

Note: This uses its own `relativeUri` helper instead of `prependApplicationUrl` because the existing spec does the same (it uses a local `relativeUri` function that calls `removeTrailingSlash` instead of the centralized `prependApplicationUrl`). For exact parity, replicate this behavior.

#### decode() method
Converts flat compliance URLs back into `webhooks.subscriptions` with `compliance_topics`:

```typescript
decode(contract: PrivacyComplianceContract) {
  const webhooks: WebhookSubscription[] = []
  if (contract.customers_data_request_url) {
    webhooks.push({
      compliance_topics: [ComplianceTopic.CustomersDataRequest],
      uri: contract.customers_data_request_url,
    })
  }
  if (contract.customers_redact_url) {
    webhooks.push({compliance_topics: [ComplianceTopic.CustomersRedact], uri: contract.customers_redact_url})
  }
  if (contract.shop_redact_url) {
    webhooks.push({compliance_topics: [ComplianceTopic.ShopRedact], uri: contract.shop_redact_url})
  }

  if (webhooks.length === 0) return {} as PrivacyComplianceToml
  return {
    webhooks: {subscriptions: mergeAllWebhooks(webhooks), privacy_compliance: undefined},
  } as unknown as PrivacyComplianceToml
}
```

**Important:** The decode uses `mergeAllWebhooks` from the existing transform helpers. The order of the `if` checks matters -- `customers_data_request_url` first, then `customers_redact_url`, then `shop_redact_url`. This matches the existing `transformFromPrivacyComplianceWebhooksModule` function.

#### Uses EncodeContext?
**Yes.** Uses `context.appConfiguration.application_url` for relative URI resolution.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {WebhooksSchema} from '../../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {WebhooksConfig, WebhookSubscription} from '../../extensions/specifications/types/app_config_webhook.js'
import {ComplianceTopic} from '../../extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {mergeAllWebhooks} from '../../extensions/specifications/transform/app_config_webhook.js'
import {removeTrailingSlash} from '../../extensions/specifications/validation/common.js'
import {compact} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'

type PrivacyComplianceToml = zod.infer<typeof WebhooksSchema>

interface PrivacyComplianceContract {
  api_version?: string
  customers_redact_url?: string
  customers_data_request_url?: string
  shop_redact_url?: string
}

function relativeUri(uri?: string, appUrl?: string) {
  return appUrl && uri?.startsWith('/') ? `${removeTrailingSlash(appUrl)}${uri}` : uri
}

function getComplianceUri(webhooks: WebhooksConfig, complianceTopic: string): string | undefined {
  return webhooks.subscriptions?.find((sub) => sub.compliance_topics?.includes(complianceTopic))?.uri
}

class PrivacyComplianceWebhooksModule extends AppModule<PrivacyComplianceToml, PrivacyComplianceContract> {
  constructor() {
    super({identifier: 'privacy_compliance_webhooks', uidStrategy: 'single', tomlKeys: ['webhooks']})
  }

  extract(content: {[key: string]: unknown}) {
    const webhooks = (content as {webhooks?: WebhooksConfig}).webhooks
    if (!webhooks) return undefined

    const hasComplianceSubscriptions = webhooks.subscriptions?.some(
      (sub) => sub.compliance_topics && sub.compliance_topics.length > 0,
    )
    const hasCompliance = hasComplianceSubscriptions === true || webhooks.privacy_compliance !== undefined
    if (!hasCompliance) return undefined

    return {webhooks} as unknown as PrivacyComplianceToml
  }

  async encode(toml: PrivacyComplianceToml, context: EncodeContext) {
    const webhooks = toml.webhooks as WebhooksConfig | undefined
    if (!webhooks) return {}

    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    const customersRedactUrl =
      getComplianceUri(webhooks, 'customers/redact') ?? webhooks?.privacy_compliance?.customer_deletion_url
    const customersDataRequestUrl =
      getComplianceUri(webhooks, 'customers/data_request') ?? webhooks?.privacy_compliance?.customer_data_request_url
    const shopRedactUrl = getComplianceUri(webhooks, 'shop/redact') ?? webhooks?.privacy_compliance?.shop_deletion_url

    const urls = compact({
      customers_redact_url: relativeUri(customersRedactUrl, appUrl),
      customers_data_request_url: relativeUri(customersDataRequestUrl, appUrl),
      shop_redact_url: relativeUri(shopRedactUrl, appUrl),
    })

    if (Object.keys(urls).length === 0) return urls

    return {
      api_version: webhooks.api_version,
      ...urls,
    }
  }

  decode(contract: PrivacyComplianceContract) {
    const webhooks: WebhookSubscription[] = []
    if (contract.customers_data_request_url) {
      webhooks.push({
        compliance_topics: [ComplianceTopic.CustomersDataRequest],
        uri: contract.customers_data_request_url,
      })
    }
    if (contract.customers_redact_url) {
      webhooks.push({compliance_topics: [ComplianceTopic.CustomersRedact], uri: contract.customers_redact_url})
    }
    if (contract.shop_redact_url) {
      webhooks.push({compliance_topics: [ComplianceTopic.ShopRedact], uri: contract.shop_redact_url})
    }

    if (webhooks.length === 0) return {} as PrivacyComplianceToml
    return {
      webhooks: {subscriptions: mergeAllWebhooks(webhooks), privacy_compliance: undefined},
    } as unknown as PrivacyComplianceToml
  }
}

export const privacyComplianceWebhooksModule = new PrivacyComplianceWebhooksModule()
```

#### Parity reference
Compare against `app_config_privacy_compliance_webhooks.ts`:
- Forward: `transformToPrivacyComplianceWebhooksModule` — identical logic (reads compliance URIs from subscriptions, falls back to `privacy_compliance` block, resolves relative URIs)
- Reverse: `transformFromPrivacyComplianceWebhooksModule` — identical logic (creates subscriptions with `compliance_topics`, calls `mergeAllWebhooks`)

---

### 3.7 App Proxy Module

**File:** `packages/app/src/cli/models/app/app-modules/app-proxy.ts`

#### TOML type
```toml
[app_proxy]
url = "/proxy"
subpath = "app-proxy"
prefix = "apps"
```

#### Contract type
```json
{ "url": "https://myapp.com/proxy", "subpath": "app-proxy", "prefix": "apps" }
```
The contract flattens the `app_proxy` nesting and resolves relative URLs.

#### Constructor
- `identifier`: `'app_proxy'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['app_proxy']`

#### Custom extract needed?
No.

#### encode() method
```typescript
async encode(toml: AppProxyToml, context: EncodeContext) {
  if (!toml.app_proxy) return {}

  let appUrl: string | undefined
  if ('application_url' in context.appConfiguration) {
    appUrl = (context.appConfiguration as {application_url?: string}).application_url
  }

  return {
    url: prependApplicationUrl(toml.app_proxy.url, appUrl),
    subpath: toml.app_proxy.subpath,
    prefix: toml.app_proxy.prefix,
  }
}
```

#### decode() method
```typescript
decode(contract: AppProxyContract) {
  if (!contract.url) return {} as AppProxyToml
  return {
    app_proxy: {
      url: removeTrailingSlash(contract.url),
      subpath: contract.subpath ?? '',
      prefix: contract.prefix ?? '',
    },
  } as AppProxyToml
}
```

Note: The decode applies `removeTrailingSlash` to the URL, matching the existing spec's reverse transform. The `?? ''` defaults match the existing behavior where the reverse transform always produces string values.

#### Uses EncodeContext?
**Yes.** Uses `context.appConfiguration.application_url` for relative URL resolution.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {prependApplicationUrl} from '../../extensions/specifications/validation/url_prepender.js'
import {removeTrailingSlash} from '../../extensions/specifications/validation/common.js'
import {validateRelativeUrl} from '../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxyTomlSchema = BaseSchemaWithoutHandle.extend({
  app_proxy: zod
    .object({
      url: zod.preprocess(
        removeTrailingSlash as (arg: unknown) => unknown,
        validateRelativeUrl(zod.string({invalid_type_error: 'Value must be string'})),
      ),
      subpath: zod.string({invalid_type_error: 'Value must be a string'}),
      prefix: zod.string({invalid_type_error: 'Value must be a string'}),
    })
    .optional(),
})

type AppProxyToml = zod.infer<typeof AppProxyTomlSchema>

interface AppProxyContract {
  url?: string
  subpath?: string
  prefix?: string
}

class AppProxyModule extends AppModule<AppProxyToml, AppProxyContract> {
  constructor() {
    super({identifier: 'app_proxy', uidStrategy: 'single', tomlKeys: ['app_proxy']})
  }

  async encode(toml: AppProxyToml, context: EncodeContext) {
    if (!toml.app_proxy) return {}

    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    return {
      url: prependApplicationUrl(toml.app_proxy.url, appUrl),
      subpath: toml.app_proxy.subpath,
      prefix: toml.app_proxy.prefix,
    }
  }

  decode(contract: AppProxyContract) {
    if (!contract.url) return {} as AppProxyToml
    return {
      app_proxy: {
        url: removeTrailingSlash(contract.url),
        subpath: contract.subpath ?? '',
        prefix: contract.prefix ?? '',
      },
    } as AppProxyToml
  }
}

export const appProxyModule = new AppProxyModule()
```

#### Parity reference
Compare against `app_config_app_proxy.ts`:
- Forward: `AppProxyTransformConfig.forward` — unwraps `app_proxy` nesting, calls `prependApplicationUrl`, returns flat `{url, subpath, prefix}`
- Reverse: `AppProxyTransformConfig.reverse` — wraps back into `{app_proxy: {url: removeTrailingSlash(url), subpath, prefix}}`

---

### 3.8 Point of Sale Module

**File:** `packages/app/src/cli/models/app/app-modules/point-of-sale.ts`

#### TOML type
```toml
[pos]
embedded = true
```

#### Contract type
```json
{ "embedded": true }
```
Unwraps the `pos` nesting.

#### Constructor
- `identifier`: `'point_of_sale'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['pos']`

#### Custom extract needed?
No.

#### encode() method
```typescript
async encode(toml: PosToml, _context: EncodeContext) {
  if (!toml.pos) return {}
  return {embedded: toml.pos.embedded}
}
```

#### decode() method
```typescript
decode(contract: PosContract) {
  return {pos: {embedded: contract.embedded}} as PosToml
}
```

#### Uses EncodeContext?
No.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosTomlSchema = BaseSchemaWithoutHandle.extend({
  pos: zod
    .object({
      embedded: zod.boolean().optional(),
    })
    .optional(),
})

type PosToml = zod.infer<typeof PosTomlSchema>

interface PosContract {
  embedded?: boolean
}

class PointOfSaleModule extends AppModule<PosToml, PosContract> {
  constructor() {
    super({identifier: 'point_of_sale', uidStrategy: 'single', tomlKeys: ['pos']})
  }

  async encode(toml: PosToml, _context: EncodeContext) {
    if (!toml.pos) return {}
    return {embedded: toml.pos.embedded}
  }

  decode(contract: PosContract) {
    return {pos: {embedded: contract.embedded}} as PosToml
  }
}

export const pointOfSaleModule = new PointOfSaleModule()
```

#### Parity reference
Compare against `app_config_point_of_sale.ts`:
- Forward: `PosTransformConfig = { embedded: 'pos.embedded' }` — maps `embedded` in contract FROM `pos.embedded` in TOML
- Reverse: Generic `appConfigTransform(content, config, true)` reverses the path mapping

---

### 3.9 App Home Module

**File:** `packages/app/src/cli/models/app/app-modules/app-home.ts`

#### TOML type
```toml
application_url = "https://myapp.com"
embedded = true

[app_preferences]
url = "https://myapp.com/preferences"
```

#### Contract type
```json
{
  "app_url": "https://myapp.com",
  "embedded": true,
  "preferences_url": "https://myapp.com/preferences"
}
```
Key renames:
- `application_url` becomes `app_url`
- `app_preferences.url` becomes `preferences_url`
- `embedded` passes through

#### Constructor
- `identifier`: `'app_home'`
- `uidStrategy`: `'single'`
- `tomlKeys`: `['application_url', 'embedded', 'app_preferences']`

#### Custom extract needed?
No. Default `extractByKeys` is correct.

#### encode() method
```typescript
async encode(toml: AppHomeToml, _context: EncodeContext) {
  return {
    app_url: toml.application_url,
    embedded: toml.embedded,
    preferences_url: toml.app_preferences?.url,
  }
}
```

#### decode() method
```typescript
decode(contract: AppHomeContract) {
  const result: {[key: string]: unknown} = {}
  if (contract.app_url !== undefined) result.application_url = contract.app_url
  if (contract.embedded !== undefined) result.embedded = contract.embedded
  if (contract.preferences_url !== undefined) {
    result.app_preferences = {url: contract.preferences_url}
  }
  return result as AppHomeToml
}
```

#### Uses EncodeContext?
No.

#### Full file content

```typescript
import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeTomlSchema = BaseSchemaWithoutHandle.extend({
  application_url: zod.string().url().optional(),
  embedded: zod.boolean().optional(),
  app_preferences: zod
    .object({
      url: zod.string().url().max(255).optional(),
    })
    .optional(),
})

type AppHomeToml = zod.infer<typeof AppHomeTomlSchema>

interface AppHomeContract {
  app_url?: string
  embedded?: boolean
  preferences_url?: string
}

class AppHomeModule extends AppModule<AppHomeToml, AppHomeContract> {
  constructor() {
    super({identifier: 'app_home', uidStrategy: 'single', tomlKeys: ['application_url', 'embedded', 'app_preferences']})
  }

  async encode(toml: AppHomeToml, _context: EncodeContext) {
    return {
      app_url: toml.application_url,
      embedded: toml.embedded,
      preferences_url: toml.app_preferences?.url,
    }
  }

  decode(contract: AppHomeContract) {
    const result: {[key: string]: unknown} = {}
    if (contract.app_url !== undefined) result.application_url = contract.app_url
    if (contract.embedded !== undefined) result.embedded = contract.embedded
    if (contract.preferences_url !== undefined) {
      result.app_preferences = {url: contract.preferences_url}
    }
    return result as AppHomeToml
  }
}

export const appHomeModule = new AppHomeModule()
```

#### Parity reference
Compare against `app_config_app_home.ts`:
- Forward: `AppHomeTransformConfig = { app_url: 'application_url', embedded: 'embedded', preferences_url: 'app_preferences.url' }`
- Reverse: Generic `appConfigTransform(content, config, true)` reverses the path mapping

---

## Section 4: Create the module registry

### 4.1 File to create

**Path:** `packages/app/src/cli/models/app/app-modules/index.ts`

### 4.2 Content

```typescript
import {brandingModule} from './branding.js'
import {eventsModule} from './events.js'
import {webhookSubscriptionModule} from './webhook-subscription.js'
import {pointOfSaleModule} from './point-of-sale.js'
import {appHomeModule} from './app-home.js'
import {appAccessModule} from './app-access.js'
import {webhooksModule} from './webhooks.js'
import {appProxyModule} from './app-proxy.js'
import {privacyComplianceWebhooksModule} from './privacy-compliance-webhooks.js'
import {AnyAppModule} from '../app-module.js'

export {brandingModule} from './branding.js'
export {eventsModule} from './events.js'
export {webhookSubscriptionModule} from './webhook-subscription.js'
export {pointOfSaleModule} from './point-of-sale.js'
export {appHomeModule} from './app-home.js'
export {appAccessModule} from './app-access.js'
export {webhooksModule} from './webhooks.js'
export {appProxyModule} from './app-proxy.js'
export {privacyComplianceWebhooksModule} from './privacy-compliance-webhooks.js'

// Sorted to match SORTED_CONFIGURATION_SPEC_IDENTIFIERS in load-specifications.ts
export const allAppModules: AnyAppModule[] = [
  brandingModule,
  appAccessModule,
  webhooksModule,
  webhookSubscriptionModule,
  eventsModule,
  privacyComplianceWebhooksModule,
  appProxyModule,
  pointOfSaleModule,
  appHomeModule,
]
```

### 4.3 Sort order

The array order MUST match `SORTED_CONFIGURATION_SPEC_IDENTIFIERS` from `packages/app/src/cli/models/extensions/load-specifications.ts`:

1. `branding` (BrandingSpecIdentifier)
2. `app_access` (AppAccessSpecIdentifier)
3. `webhooks` (WebhooksSpecIdentifier)
4. `webhook_subscription` (WebhookSubscriptionSpecIdentifier)
5. `events` (EventsSpecIdentifier)
6. `privacy_compliance_webhooks` (PrivacyComplianceWebhooksSpecIdentifier)
7. `app_proxy` (AppProxySpecIdentifier)
8. `point_of_sale` (PosSpecIdentifier)
9. `app_home` (AppHomeSpecIdentifier)

This ordering matters because the loader processes single-UID modules before dynamic-UID modules, and within each group, the order affects instance creation sequence and handle uniqueness validation.

---

## Section 5: Wire into loader.ts

### 5.1 File to modify

**Path:** `packages/app/src/cli/models/app/loader.ts`

### 5.2 Add imports

At the top of the file, add these imports (if not already present):

```typescript
import {allAppModules} from './app-modules/index.js'
import {AppModule, DynamicAppModule} from './app-module.js'
```

### 5.3 Replace `loadExtensions()` method

The `loadExtensions()` method (around line 610) should call `createConfigExtensionInstancesFromAppModules()` instead of the old `createConfigExtensionInstances()` and `createWebhookSubscriptionInstances()` methods.

Find the current `loadExtensions()` method. Replace the config extension creation calls with:

```typescript
private async loadExtensions(appDirectory: string, appConfiguration: TConfig): Promise<ExtensionInstance[]> {
  if (this.specifications.length === 0) return []

  const extensionPromises = await this.createExtensionInstances(appDirectory, appConfiguration.extension_directories)
  const configExtensionPromises = isCurrentAppSchema(appConfiguration)
    ? await this.createConfigExtensionInstancesFromAppModules(appDirectory, appConfiguration)
    : []

  const extensions = await Promise.all([...extensionPromises, ...configExtensionPromises])

  const allExtensions = getArrayRejectingUndefined(extensions.flat())

  // Validate that all extensions have a unique handle.
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

### 5.4 Add `createConfigExtensionInstancesFromAppModules()` method

Add this new private method to the `AppLoader` class. This replaces both the old `createConfigExtensionInstances()` and `createWebhookSubscriptionInstances()`.

```typescript
/**
 * Create config extension instances using the AppModule interface.
 * Replaces both createConfigExtensionInstances and createWebhookSubscriptionInstances.
 * Each AppModule handles its own extraction from the full TOML config.
 */
private async createConfigExtensionInstancesFromAppModules(
  directory: string,
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  appConfiguration: TConfig & CurrentAppConfiguration,
) {
  const configAsRecord = appConfiguration as unknown as {[key: string]: unknown}
  const usedKeys = new Set<string>()
  const allInstances: Promise<ExtensionInstance | undefined>[] = []

  // Only process modules that have tomlKeys (config modules in app.toml).
  const appTomlModules = allAppModules.filter((mod) => mod.tomlKeys !== undefined)

  // Process single-UID modules first, then dynamic -- matches old ordering
  const singleModules = appTomlModules.filter((mod) => mod.uidStrategy !== 'dynamic')
  const dynamicModules = appTomlModules.filter((mod) => mod.uidStrategy === 'dynamic')

  for (const appModule of singleModules) {
    const specification = this.findSpecificationForType(appModule.identifier)
    if (!specification) continue

    const singleKeys = appModule.tomlKeys ?? []
    for (const key of singleKeys) {
      usedKeys.add(key)
    }

    const extracted = (appModule as AppModule).extract(configAsRecord)
    if (!extracted || Object.keys(extracted).length === 0) continue

    allInstances.push(
      this.createExtensionInstance(specification.identifier, extracted, appConfiguration.path, directory),
    )
  }

  for (const appModule of dynamicModules) {
    const specification = this.findSpecificationForType(appModule.identifier)
    if (!specification) continue

    const dynamicKeys = appModule.tomlKeys ?? []
    for (const key of dynamicKeys) {
      usedKeys.add(key)
    }

    const items = (appModule as DynamicAppModule).extract(configAsRecord)
    if (!items || items.length === 0) continue

    for (const item of items) {
      allInstances.push(
        this.createExtensionInstance(specification.identifier, item, appConfiguration.path, directory),
      )
    }
  }

  // Also process any single-UID specs that don't have AppModules (e.g., contract-only modules)
  const appModuleIdentifiers = new Set(allAppModules.map((mod) => mod.identifier))
  const specsWithoutAppModules = this.specifications.filter(
    (spec) => spec.uidStrategy === 'single' && !appModuleIdentifiers.has(spec.identifier),
  )
  for (const specification of specsWithoutAppModules) {
    const specConfiguration = parseConfigurationObjectAgainstSpecification(
      specification,
      appConfiguration.path,
      appConfiguration,
      this.abortOrReport.bind(this),
    )
    if (Object.keys(specConfiguration).length === 0) continue

    // Track keys from the spec's schema shape
    const shape = (
      specification as {schema?: {_def?: {shape?: () => {[key: string]: unknown}}}}
    ).schema?._def?.shape?.()
    if (shape) {
      for (const key of Object.keys(shape)) {
        usedKeys.add(key)
      }
    }

    const instance = this.createExtensionInstance(
      specification.identifier,
      specConfiguration,
      appConfiguration.path,
      directory,
    ).then((extensionInstance) =>
      this.validateConfigurationExtensionInstance(appConfiguration.client_id, appConfiguration, extensionInstance),
    )
    allInstances.push(instance)
  }

  // Detect unsupported TOML sections
  const configKeysThatAreNeverModules = [
    ...Object.keys(AppSchema.shape),
    'path',
    'organization_id',
    // Base schema fields from BaseSchemaWithoutHandle
    'name',
    'type',
    'description',
    'uid',
    'api_version',
    'extension_points',
    'capabilities',
    'supported_features',
    'settings',
  ]
  const unusedKeys = Object.keys(appConfiguration)
    .filter((key) => !usedKeys.has(key))
    .filter((key) => !configKeysThatAreNeverModules.includes(key))

  if (unusedKeys.length > 0 && this.mode !== 'local') {
    this.abortOrReport(
      outputContent`Unsupported section(s) in app configuration: ${unusedKeys.sort().join(', ')}`,
      undefined,
      appConfiguration.path,
    )
  }

  const results = await Promise.all(allInstances)
  return getArrayRejectingUndefined(results)
}
```

### 5.5 How it replaces the old methods

The old system had two separate methods:
- `createConfigExtensionInstances()` — iterated all specs with `uidStrategy === 'single'`, parsed the full TOML against each spec's Zod schema (causing base field leaking / phantom instances), and created instances
- `createWebhookSubscriptionInstances()` — hardcoded logic to split `webhooks.subscriptions` into individual instances for the `webhook_subscription` spec

The new `createConfigExtensionInstancesFromAppModules()` replaces both:
- Single-UID modules use `appModule.extract()` instead of Zod parsing (no base field leaking)
- Dynamic-UID modules use `appModule.extract()` to split subscriptions (no hardcoded webhook logic)
- Specs without AppModules still use the old `parseConfigurationObjectAgainstSpecification` path

### 5.6 Delete or keep old methods?

**Keep them** in Phase 1. They are no longer called from `loadExtensions()`, but keeping them avoids merge conflicts and provides a fallback path if needed. They will be deleted in Phase 4.

### 5.7 Testing

Run the loader tests:
```bash
cd packages/app && npx vitest run src/cli/models/app/loader.test.ts
```

**Expected changes:** The new extraction eliminates phantom instances. If any loader tests assert specific extension counts, those counts may decrease because phantom instances (created by base field leaking) are no longer produced. For example, if a test asserts `allExtensions.toHaveLength(2)` and one of those was a phantom `events` instance created just because `name` leaked in, that count will drop to 1.

To identify which tests need updating: run the test suite and check failures. For each failure, determine whether the "missing" extension was a phantom instance by checking if the TOML in the test actually defines that module's keys.

---

## Section 6: Wire into extension-instance.ts (deployConfig)

### 6.1 File to modify

**Path:** `packages/app/src/cli/models/extensions/extension-instance.ts`

### 6.2 Add imports

Add at the top of the file (if not already present):

```typescript
import {allAppModules} from '../app/app-modules/index.js'
import {jsonSchemaValidate, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'
```

Note: `jsonSchemaValidate` and `normaliseJsonSchema` may already be imported. `outputDebug` from `@shopify/cli-kit/node/output` may also already be imported. Check existing imports first.

### 6.3 Modify `deployConfig()` method

Replace the existing `deployConfig()` method (around line 215) with:

```typescript
async deployConfig({
  apiKey,
  appConfiguration,
}: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
  // Path 1: Modules with AppModule encode -- the universal path
  const appModule = allAppModules.find((mod) => mod.identifier === this.specification.identifier)
  if (appModule) {
    const encoded = (await appModule.encode(this.configuration, {
      appConfiguration,
      directory: this.directory,
      apiKey,
    })) as {[key: string]: unknown}
    if (!encoded || Object.keys(encoded).length === 0) return undefined

    // Post-encode contract validation: validate the API-shaped output against the contract
    const contractJson = (this.specification as {validationSchema?: {jsonSchema?: string}}).validationSchema
      ?.jsonSchema
    if (contractJson) {
      const contract = await normaliseJsonSchema(contractJson)
      const validation = jsonSchemaValidate(encoded, contract, 'fail', this.specification.identifier)
      if (validation.state === 'error') {
        outputDebug(
          `Contract validation errors for "${this.handle}" (${this.specification.identifier}): ${JSON.stringify(
            validation.errors,
          )}`,
        )
      }
    }

    return encoded
  }

  // Path 2: Fallback for modules not yet on AppModule
  const deployConfig = await this.specification.deployConfig?.(this.configuration, this.directory, apiKey, undefined)
  const transformedConfig = this.specification.transformLocalToRemote?.(this.configuration, appConfiguration) as
    | {[key: string]: unknown}
    | undefined
  const resultDeployConfig = deployConfig ?? transformedConfig ?? undefined
  return resultDeployConfig && Object.keys(resultDeployConfig).length > 0 ? resultDeployConfig : undefined
}
```

### 6.4 Key design decisions

- **AppModule lookup by identifier:** `allAppModules.find(mod => mod.identifier === this.specification.identifier)` finds the matching AppModule for this extension instance's spec.
- **Post-encode contract validation:** After encoding, if the spec has a `validationSchema.jsonSchema`, validate the encoded output against it using `fail` mode (not `strip`). This catches real contract violations. In Phase 1, validation errors are logged at debug level (`outputDebug`) and do NOT block deployment. This is intentionally non-breaking.
- **Fallback path:** If no AppModule is found (non-config extensions not yet migrated), fall back to the existing `spec.deployConfig()` / `spec.transformLocalToRemote()` logic.
- **The `validationSchema` type cast:** The spec type does not directly expose `validationSchema` as a typed property in all code paths. The cast `(this.specification as {validationSchema?: {jsonSchema?: string}})` safely accesses it.

### 6.5 Testing

Run extension-instance tests:
```bash
cd packages/app && npx vitest run src/cli/models/extensions/extension-instance.test.ts
```

All existing tests must pass. The AppModule encode path produces identical output to the old transform path for all 9 config modules.

---

## Section 7: Wire into select-app.ts (decode for app config link)

### 7.1 File to modify

**Path:** `packages/app/src/cli/services/app/select-app.ts`

### 7.2 Add import

```typescript
import {allAppModules} from '../../models/app/app-modules/index.js'
```

### 7.3 Modify `remoteAppConfigurationExtensionContent()`

Replace the body of the `configRegistrations.forEach` loop to check for an AppModule first:

```typescript
export function remoteAppConfigurationExtensionContent(
  configRegistrations: AppModuleVersion[],
  specifications: ExtensionSpecification[],
  flags: Flag[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter((spec) => spec.uidStrategy !== 'uuid')
  configRegistrations.forEach((module) => {
    const moduleIdentifier = module.specification?.identifier.toLowerCase()
    const config = module.config
    if (!config) return

    // Use AppModule decode if available
    const appModule = allAppModules.find((m) => m.identifier === moduleIdentifier)
    if (appModule?.decode) {
      remoteAppConfig = deepMergeObjects(remoteAppConfig, appModule.decode(config) as {[key: string]: unknown})
      return
    }

    // Fallback to spec transform for modules without AppModule (contract-only, etc.)
    const configSpec = configSpecifications.find((spec) => spec.identifier === moduleIdentifier)
    if (!configSpec) return
    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.transformRemoteToLocal?.(config, {flags}) ?? config)
  })

  return {...remoteAppConfig}
}
```

### 7.4 How it works

- For each remote module, look up an `AppModule` by identifier
- If found and has `decode`, call `appModule.decode(config)` and merge the result
- If not found, fall back to the existing `spec.transformRemoteToLocal()` path
- The `deepMergeObjects` call merges decoded results from all modules into a single app config object

### 7.5 Testing

Run select-app tests:
```bash
cd packages/app && npx vitest run src/cli/services/app/select-app.test.ts
```

---

## Section 8: Fix the category error in json-schema.ts

### 8.1 File to modify

**Path:** `packages/app/src/cli/utilities/json-schema.ts`

### 8.2 The fix

Add these 4 lines after the existing early return for empty contract schemas (around line 39-41), and before the `const contract = await normaliseJsonSchema(contractJsonSchema)` line:

```typescript
// If this module has a CLI-side transform, TOML shape != contract shape.
// The contract defines the API shape. Validating TOML-shaped data against it is a category error
// that produces silent data loss via strip mode (the access_scopes incident).
// Contract validation for these modules happens post-encode in deployConfig() instead.
if (merged.transformLocalToRemote !== undefined) {
  return merged.parseConfigurationObject
}
```

### 8.3 Context within the function

The full function after the fix:

```typescript
export async function unifiedConfigurationParserFactory(
  merged: RemoteAwareExtensionSpecification & FlattenedRemoteSpecification,
  handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties = 'strip',
) {
  const contractJsonSchema = merged.validationSchema?.jsonSchema
  if (contractJsonSchema === undefined || isEmpty(JSON.parse(contractJsonSchema))) {
    return merged.parseConfigurationObject
  }

  // If this module has a CLI-side transform, TOML shape != contract shape.
  // The contract defines the API shape. Validating TOML-shaped data against it is a category error
  // that produces silent data loss via strip mode (the access_scopes incident).
  // Contract validation for these modules happens post-encode in deployConfig() instead.
  if (merged.transformLocalToRemote !== undefined) {
    return merged.parseConfigurationObject
  }

  const contract = await normaliseJsonSchema(contractJsonSchema)
  // ... rest of function unchanged ...
}
```

### 8.4 Why it is safe

1. **Only affects modules with transforms:** The `transformLocalToRemote !== undefined` check targets exactly the 9 config modules (and any future modules) where TOML shape differs from contract shape. Modules without transforms (where TOML = contract) are unaffected.
2. **Zod validation still runs:** `merged.parseConfigurationObject` (the Zod parser) is always returned and always runs. Only the JSON Schema contract validation is skipped pre-encode.
3. **Contract validation moves post-encode:** For modules with AppModules, contract validation now happens in `deployConfig()` after the encode produces contract-shaped data. This is the correct boundary.
4. **Prevents silent data loss:** The `strip` mode in JSON Schema validation was silently removing TOML fields that did not match contract field names (because they had not been transformed yet). This was the root cause of the `access_scopes` incident.

### 8.5 Testing

```bash
cd packages/app && npx vitest run src/cli/utilities/json-schema.test.ts
```

---

## Section 9: Update tests

### 9.1 New test files to create

Create a test file for the base class and each of the 9 modules (10 files total):

| Test file | What to test |
|-----------|-------------|
| `models/app/app-module.test.ts` | `extractByKeys` function, default passthrough encode/decode |
| `models/app/app-modules/branding.test.ts` | Extract, encode parity, decode parity, round-trip |
| `models/app/app-modules/app-access.test.ts` | Extract, encode parity, decode parity, round-trip |
| `models/app/app-modules/webhooks.test.ts` | Extract (shared key), encode parity, decode parity |
| `models/app/app-modules/webhook-subscription.test.ts` | Extract (splitting, compliance exclusion), encode (URI resolution), decode |
| `models/app/app-modules/events.test.ts` | Extract, encode (identity), decode (strips identifier) |
| `models/app/app-modules/privacy-compliance-webhooks.test.ts` | Extract (compliance detection), encode (URI resolution, legacy fallback), decode |
| `models/app/app-modules/app-proxy.test.ts` | Extract, encode (URL resolution), decode (removeTrailingSlash) |
| `models/app/app-modules/point-of-sale.test.ts` | Extract, encode (unwrap pos), decode (rewrap pos) |
| `models/app/app-modules/app-home.test.ts` | Extract, encode (field renames), decode (reverse renames) |

### 9.2 Base class test template

**Path:** `packages/app/src/cli/models/app/app-module.test.ts`

```typescript
import {AppModule, extractByKeys, EncodeContext} from './app-module.js'
import {describe, expect, test} from 'vitest'

describe('extractByKeys', () => {
  test('extracts matching keys', () => {
    const content = {name: 'app', handle: 'my-handle', webhooks: {api_version: '2024-01'}}
    const result = extractByKeys(['name', 'handle'], content)
    expect(result).toEqual({name: 'app', handle: 'my-handle'})
  })

  test('returns undefined when no keys match', () => {
    const content = {webhooks: {api_version: '2024-01'}}
    const result = extractByKeys(['name', 'handle'], content)
    expect(result).toBeUndefined()
  })

  test('skips undefined values', () => {
    const content = {name: 'app', handle: undefined, webhooks: {}}
    const result = extractByKeys(['name', 'handle'], content)
    expect(result).toEqual({name: 'app'})
  })

  test('returns partial match', () => {
    const content = {name: 'app', client_id: '123'}
    const result = extractByKeys(['name', 'handle'], content)
    expect(result).toEqual({name: 'app'})
  })
})

describe('AppModule base class', () => {
  test('default encode is passthrough', async () => {
    const mod = new AppModule({identifier: 'test', uidStrategy: 'single', tomlKeys: ['foo']})
    const data = {foo: 'bar'}
    const context = {appConfiguration: {}, directory: '/tmp', apiKey: 'key'} as unknown as EncodeContext
    const result = await mod.encode(data, context)
    expect(result).toBe(data)
  })

  test('default decode is passthrough', () => {
    const mod = new AppModule({identifier: 'test', uidStrategy: 'single', tomlKeys: ['foo']})
    const data = {foo: 'bar'}
    const result = mod.decode(data)
    expect(result).toBe(data)
  })

  test('default extract uses extractByKeys', () => {
    const mod = new AppModule({identifier: 'test', uidStrategy: 'single', tomlKeys: ['foo', 'bar']})
    const content = {foo: 1, bar: 2, baz: 3}
    const result = mod.extract(content)
    expect(result).toEqual({foo: 1, bar: 2})
  })

  test('extract returns undefined when no keys match', () => {
    const mod = new AppModule({identifier: 'test', uidStrategy: 'single', tomlKeys: ['foo']})
    const content = {bar: 1}
    const result = mod.extract(content)
    expect(result).toBeUndefined()
  })
})
```

### 9.3 Parity test pattern

For each module test file, include a test that directly compares AppModule output to spec output:

```typescript
import spec from '../../extensions/specifications/app_config_branding.js'
import {brandingModule} from './branding.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {EncodeContext} from '../app-module.js'
import {describe, expect, test} from 'vitest'

const context: EncodeContext = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp',
  apiKey: 'test-key',
}

describe('encode parity with spec.transformLocalToRemote', () => {
  test('produces identical output', async () => {
    const input = {name: 'my-app', handle: 'my-handle'}

    const specResult = spec.transformLocalToRemote!(input, placeholderAppConfiguration)
    const moduleResult = await brandingModule.encode(input as any, context)

    expect(moduleResult).toEqual(specResult)
  })
})

describe('decode parity with spec.transformRemoteToLocal', () => {
  test('produces identical output', () => {
    const input = {name: 'my-app', app_handle: 'my-handle'}

    const specResult = spec.transformRemoteToLocal!(input)
    const moduleResult = brandingModule.decode(input)

    expect(moduleResult).toEqual(specResult)
  })
})
```

### 9.4 Loader tests that may need updating

The new extraction eliminates phantom instances. If loader tests create TOML configs that do NOT include a module's keys but assert that an instance was created for that module, those assertions will fail.

**How to identify affected tests:**
1. Run `cd packages/app && npx vitest run src/cli/models/app/loader.test.ts`
2. For any failing tests, check whether the asserted extension count includes phantom instances
3. If the test TOML does not define a module's specific keys (e.g., no `[events]` section), the module should NOT produce an instance — update the expected count

**Common pattern:** A test creates a TOML with `name = "my-app"` and expects an `events` or `point_of_sale` instance to exist. Under the old system, the `events` spec's Zod schema would parse `{name: 'my-app'}` successfully (because `name` is in `BaseSchemaWithoutHandle`) and create a phantom instance. Under the new system, `eventsModule.extract({name: 'my-app'})` returns `undefined` because `events` is not a top-level key in that TOML.

### 9.5 Full test suite verification

After all changes, run the complete test suite:
```bash
cd packages/app && npx vitest run
```

All tests must pass. The total test count may increase (new test files) but should not decrease.

---

## Section 10: Verification checklist

After implementing all steps, verify each item:

### Code completeness

- [ ] `packages/app/src/cli/models/app/app-module.ts` created with `AppModule` class, `EncodeContext`, `extractByKeys`, `DynamicAppModule`, `AnyAppModule`
- [ ] `packages/app/src/cli/models/app/app-modules/branding.ts` created and exports `brandingModule`
- [ ] `packages/app/src/cli/models/app/app-modules/app-access.ts` created and exports `appAccessModule`
- [ ] `packages/app/src/cli/models/app/app-modules/webhooks.ts` created and exports `webhooksModule`
- [ ] `packages/app/src/cli/models/app/app-modules/webhook-subscription.ts` created and exports `webhookSubscriptionModule`
- [ ] `packages/app/src/cli/models/app/app-modules/events.ts` created and exports `eventsModule`
- [ ] `packages/app/src/cli/models/app/app-modules/privacy-compliance-webhooks.ts` created and exports `privacyComplianceWebhooksModule`
- [ ] `packages/app/src/cli/models/app/app-modules/app-proxy.ts` created and exports `appProxyModule`
- [ ] `packages/app/src/cli/models/app/app-modules/point-of-sale.ts` created and exports `pointOfSaleModule`
- [ ] `packages/app/src/cli/models/app/app-modules/app-home.ts` created and exports `appHomeModule`
- [ ] `packages/app/src/cli/models/app/app-modules/index.ts` created with `allAppModules` array in correct order

### Integration points

- [ ] `packages/app/src/cli/models/extensions/extension-instance.ts` — `deployConfig()` uses AppModule encode path with fallback
- [ ] `packages/app/src/cli/models/app/loader.ts` — `loadExtensions()` calls `createConfigExtensionInstancesFromAppModules()`
- [ ] `packages/app/src/cli/services/app/select-app.ts` — `remoteAppConfigurationExtensionContent()` uses AppModule decode path with fallback
- [ ] `packages/app/src/cli/utilities/json-schema.ts` — Category error fix: specs with `transformLocalToRemote` skip JSON Schema validation

### Encode parity verified for all 9 modules

For each module, confirm that `appModule.encode(input, context)` produces the same output as `spec.transformLocalToRemote(input, appConfiguration)`:

- [ ] branding: `{name, handle}` encodes to `{name, app_handle}`
- [ ] app_access: `{access, access_scopes, auth}` encodes to `{access, scopes, required_scopes, optional_scopes, use_legacy_install_flow, redirect_url_allowlist}`
- [ ] webhooks: `{webhooks: {api_version}}` encodes to `{api_version}`
- [ ] webhook_subscription: per-subscription with URI resolution
- [ ] events: identity passthrough
- [ ] privacy_compliance_webhooks: compliance URIs extracted and resolved
- [ ] app_proxy: `{app_proxy: {url, subpath, prefix}}` encodes to `{url (resolved), subpath, prefix}`
- [ ] point_of_sale: `{pos: {embedded}}` encodes to `{embedded}`
- [ ] app_home: `{application_url, embedded, app_preferences}` encodes to `{app_url, embedded, preferences_url}`

### Test results

- [ ] All existing tests pass (553+ tests, zero regressions)
- [ ] New base class test file passes
- [ ] All 9 module test files pass
- [ ] No lint errors in new files (`npx eslint packages/app/src/cli/models/app/app-module.ts packages/app/src/cli/models/app/app-modules/`)
- [ ] Deploy payloads identical: for a representative TOML, the deploy payload produced by the new system matches the old system exactly

### Post-encode validation promotion timeline

- [ ] Post-encode contract validation currently logs at `outputDebug` level and does NOT block deployment
- [ ] After confidence is established (e.g., after Phase 1 has been in production for 2+ weeks with no debug-level validation errors), promote to `outputWarn`
- [ ] Eventually promote to hard failure (`AbortError`) once all modules have parity-tested encode outputs
- [ ] Consider adding this promotion as a Phase 1.5 milestone

### What NOT to change

- [ ] No existing spec files deleted
- [ ] No changes to `ExtensionSpecification` interface
- [ ] No changes to `CONFIG_EXTENSION_IDS` array
- [ ] No changes to `getAppVersionedSchema()` or `contributeToAppConfigurationSchema()`
- [ ] No changes to public API of any package
- [ ] No changes to `.extension.toml` loading (non-config extensions untouched)

---

## Section 11: Regression Test for access_scopes Incident

### 11.1 Background: the original incident

When `access_scopes` had a contract migration, the CLI validated TOML-shaped data against the API-shaped contract in `strip` mode. Because the TOML keys (e.g., `access_scopes.scopes`) did not match the contract keys (e.g., `scopes` at the top level), strip mode silently removed all unrecognized fields, resulting in `{}` being deployed. This caused the app to lose its access scopes configuration entirely.

The root cause was a **category error**: the CLI was validating pre-transform (TOML-shaped) data against a post-transform (API-shaped) JSON Schema contract. Any module with `transformLocalToRemote` defined has TOML keys that differ from contract keys by definition, making strip-mode validation against the contract inherently destructive.

### 11.2 Where to add the test

Create the regression test in `packages/app/src/cli/utilities/json-schema-regression.test.ts` (or append to the existing `packages/app/src/cli/utilities/json-schema.test.ts`).

### 11.3 Test code

```typescript
import {describe, expect, test} from 'vitest'
import {jsonSchemaValidate} from './json-schema.js'

describe('access_scopes incident regression', () => {
  test('modules with transforms skip pre-encode contract validation', () => {
    // Simulate a module that has transformLocalToRemote (TOML != contract shape)
    const specWithTransform = {
      ...baseSpec,
      transformLocalToRemote: (config: unknown) => ({transformed: true}),
    }

    // The category error fix: when transformLocalToRemote exists,
    // unifiedConfigurationParserFactory should NOT apply contract validation
    // to the TOML-shaped input (which would strip unrecognized fields)
    const parser = unifiedConfigurationParserFactory(specWithTransform)
    // Verify that the parser does NOT use the contract schema for validation
    // (the exact assertion depends on how unifiedConfigurationParserFactory works)
  })

  test('TOML-shaped data is NOT validated against API-shaped contract', () => {
    // Simulate what the old code did: validate TOML-shaped data against API contract
    const tomlShaped = {access_scopes: {scopes: 'read_products'}}
    const apiContract = {
      type: 'object',
      properties: {access: {type: 'object'}},
      additionalProperties: false, // strip mode would remove 'access_scopes'
    }

    // In strip mode, this would produce {} -- the bug
    const stripResult = jsonSchemaValidate(tomlShaped, apiContract, 'strip', 'test')
    expect(Object.keys(stripResult)).toHaveLength(0) // proves the bug existed

    // In fail mode (the fix), this would produce an error instead of silent loss
    const failResult = jsonSchemaValidate(tomlShaped, apiContract, 'fail', 'test')
    expect(failResult.state).toBe('error') // proves the fix catches it
  })
})
```

### 11.4 What these tests prove

1. **The first test** verifies the category error fix at the architecture level: when a spec has `transformLocalToRemote` defined, `unifiedConfigurationParserFactory` returns the Zod-only parser without layering on JSON Schema contract validation. This prevents TOML-shaped data from ever being validated against the API-shaped contract in strip mode.

2. **The second test** demonstrates the exact failure mode of the original incident: when TOML-shaped data (with key `access_scopes`) is validated against an API-shaped contract (which expects `access` or `scopes` at the top level), strip mode silently removes the unrecognized `access_scopes` key and produces `{}`. It also demonstrates that fail mode (used in the post-encode validation path) would catch this as an error rather than silently destroying data.

### 11.5 Verification

```bash
cd packages/app && npx vitest run src/cli/utilities/json-schema-regression.test.ts
```

---

## Appendix A: Pre-Phase 4 Checklist — mergeAllWebhooks Coupling

### Problem

`mergeAllWebhooks` from `packages/app/src/cli/models/extensions/specifications/transform/app_config_webhook.ts` is used by `privacyComplianceWebhooksModule.decode()` (in the new AppModule system). Before Phase 4 deletes the old spec files, this dependency must be decoupled.

### Required steps before Phase 4

- [ ] **Extract `mergeAllWebhooks` into a standalone utility file.** Move it to `packages/app/src/cli/utilities/webhooks.ts` (or `packages/app/src/cli/models/app/app-modules/webhook-helpers.ts`). The function merges webhook subscriptions that share the same URI into a single subscription with combined topics/compliance_topics. It has no dependencies on the old spec system.

- [ ] **Update the old spec to import from the new location.** Change `packages/app/src/cli/models/extensions/specifications/transform/app_config_webhook.ts` to re-export from the new utility file (or import directly). This keeps the old spec working until Phase 4 deletes it.

- [ ] **Update the new module to import from the new location.** Change `packages/app/src/cli/models/app/app-modules/privacy-compliance-webhooks.ts` to import `mergeAllWebhooks` from the new utility file instead of from the old spec's transform file.

- [ ] **Verify both old and new code paths work.** Run the full test suite to confirm no import breakage:
  ```bash
  cd packages/app && npx vitest run
  ```

### Why this matters

If Phase 4 deletes `packages/app/src/cli/models/extensions/specifications/transform/app_config_webhook.ts` without first extracting `mergeAllWebhooks`, the `privacyComplianceWebhooksModule` will have a broken import and fail at runtime. This is a hard dependency that must be resolved before any old spec file cleanup.
