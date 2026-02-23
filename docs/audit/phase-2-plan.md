# Phase 2 Implementation Plan: Implement All Non-Config Extension Types as AppModule Subclasses

## Overview

Phase 2 implements all 14 non-config extension types as dedicated `AppModule` subclasses. Each subclass has a proper `encode()` method that does what the old `spec.deployConfig()` did, plus optional methods for build, validation, dev, and other capabilities. Three modules (checkout_post_purchase, function, ui_extension) are already prototyped with parity tests passing. At the end of Phase 2, every module in the system is a real `AppModule` subclass (or base instance).

---

## 1. Scope

### What changes in Phase 2

- Implement 14 `AppModule` subclasses for non-config extension types.
- Add each to the `ALL_MODULES` registry.
- Verify parity: each new module's `encode()` produces identical output to the old `spec.deployConfig()`.

### What does NOT change in Phase 2

- The old spec files remain on disk (deleted in Phase 4).
- `ExtensionSpecification` interface remains (deleted in Phase 4).
- `ExtensionInstance` is not replaced yet (that is Phase 3).
- No TOML/contract format convergence (Phase 5).

---

## 2. Implementation Order

Simplest first. Each type is implemented, tested for parity, and merged independently. Three modules (checkout_post_purchase, function, ui_extension) are already prototyped with parity tests passing.

### Batch 1: Trivial (1 day each, ~2 days total)

#### 2.1 `checkout_post_purchase` — CheckoutPostPurchaseModule

**Current spec:** `specifications/checkout_post_purchase.ts`

**encode():**
```typescript
async encode(toml: CheckoutPostPurchaseToml): Promise<CheckoutPostPurchaseContract> {
  return { metafields: toml.metafields ?? [] }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['ui_preview', 'cart_url', 'esbuild', 'single_js_entry_path']`
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/post-purchase-ui-extensions'`
- No validate, no preDeployValidation, no buildValidation.

**Complexity:** Direct field mapping, single optional field with default. No file I/O, no computed fields.

**Parity test:** `encode({metafields: [{namespace: 'x', key: 'y'}]})` matches `spec.deployConfig(...)`.

---

#### 2.2 `theme` — ThemeModule

**Current spec:** `specifications/theme.ts`

**encode():**
```typescript
async encode(): Promise<ThemeContract> {
  return { theme_extension: { files: {} } }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['theme']`
- `buildConfig`: `{mode: 'theme'}`
- `graphQLType`: `'theme_app_extension'`
- `partnersWebIdentifier`: `'theme_app_extension'`
- `preDeployValidation(instance)`: calls `validateThemeExtension(instance)` — validates file types, sizes, directory structure. This is ~60 lines of validation logic that moves to the module.

**Complexity:** Static return for encode. The complexity is in `preDeployValidation` — file system validation with size limits. Move the validation helper functions (`validateThemeExtension`, `validateExtensionBytes`, `validateLiquidBytes`, `validateFile`) into the module file or a shared utility.

**Parity test:** `encode(anything)` always returns `{theme_extension: {files: {}}}`.

---

### Batch 2: Low complexity (1-2 days each, ~8 days total)

#### 2.3 `checkout_ui_extension` — CheckoutUIModule

**Current spec:** `specifications/checkout_ui_extension.ts`

**encode():**
```typescript
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
```

**Other methods:**
- `appModuleFeatures()`: returns `['ui_preview', 'cart_url', 'esbuild', 'single_js_entry_path', 'generates_source_maps']`
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/checkout-ui-extensions'`

**Complexity:** Mostly passthrough fields plus async localization loading. The `loadLocalesConfig` call is the only non-trivial part.

**Parity test:** With and without locales directory present.

---

#### 2.4 `web_pixel_extension` — WebPixelModule

**Current spec:** `specifications/web_pixel_extension.ts`

**encode():**
```typescript
async encode(toml: WebPixelToml): Promise<WebPixelContract> {
  return {
    runtime_context: toml.runtime_context,
    customer_privacy: toml.customer_privacy,
    runtime_configuration_definition: toml.settings,  // field rename: settings -> runtime_configuration_definition
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['esbuild', 'single_js_entry_path']`
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/web-pixels-extension'`
- `buildValidation(instance)`: checks bundle size against 128KB limit.
- `preDeployValidation(instance)`: checks for deprecated `configuration` property, throws if present.

**Complexity:** Simple field mapping with one rename (`settings` -> `runtime_configuration_definition`). Two validation methods are straightforward.

**Parity test:** Verify the field rename. Verify validation throws on over-sized bundle and deprecated property.

---

#### 2.5 `tax_calculation` — TaxCalculationModule

**Current spec:** `specifications/tax_calculation.ts`

**encode():**
```typescript
async encode(toml: TaxCalculationToml): Promise<TaxCalculationContract> {
  return {
    production_api_base_url: toml.production_api_base_url,
    benchmark_api_base_url: toml.benchmark_api_base_url,
    calculate_taxes_api_endpoint: toml.calculate_taxes_api_endpoint,
    metafields: toml.metafields,
    cart_line_properties: toml.cart_line_properties,
    api_version: toml.api_version,
    metafield_identifiers: toml.input?.metafield_identifiers,  // unwrap from input.metafield_identifiers
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`
- `buildConfig`: `{mode: 'tax_calculation'}`

**Complexity:** Mostly passthrough with one field unwrap (`input.metafield_identifiers` -> `metafield_identifiers`). No file I/O.

**Parity test:** With and without `input.metafield_identifiers`.

---

#### 2.6 `editor_extension_collection` — EditorExtensionCollectionModule

**Current spec:** `specifications/editor_extension_collection.ts`

**encode():**
```typescript
async encode(toml: EditorExtensionCollectionToml, context: EncodeContext): Promise<EditorExtensionCollectionContract> {
  return {
    name: toml.name,
    handle: toml.handle,
    in_collection: toml.inCollection,  // Zod transform already merged includes + include
    localization: await loadLocalesConfig(context.directory, toml.name),
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`
- No build, no validation.

**Note:** The `EditorExtensionCollectionSchema` has a Zod `.transform()` that merges `includes` (string array) and `include` (object array with handles) into `inCollection`. This transform runs during TOML parsing, before `encode()` is called. The module receives the already-transformed data.

**Complexity:** Simple mapping plus localization. The Zod transform is a pre-existing concern that stays in the schema (parsing) layer, not in `encode()`.

**Parity test:** With both `includes` and `include` present.

---

### Batch 3: Medium complexity (2-3 days each, ~18 days total)

#### 2.7 `function` — FunctionModule

**Current spec:** `specifications/function.ts`

**encode():**
```typescript
async encode(toml: FunctionToml, context: EncodeContext): Promise<FunctionContract> {
  const moduleId = randomUUID()

  // Read top-level input query
  let inputQuery: string | undefined
  const inputQueryPath = joinPath(context.directory, 'input.graphql')
  if (await fileExists(inputQueryPath)) {
    inputQuery = await readFile(inputQueryPath)
  }

  // Read per-target input queries
  const targets = toml.targeting && await Promise.all(
    toml.targeting.map(async (target) => {
      let targetInputQuery: string | undefined
      if (target.input_query) {
        targetInputQuery = await readInputQuery(joinPath(context.directory, target.input_query))
      }
      return { handle: target.target, export: target.export, input_query: targetInputQuery }
    })
  )

  // Build UI config
  let ui: UI | undefined
  if (toml.ui?.paths) {
    ui = {
      app_bridge: { details_path: toml.ui.paths.details, create_path: toml.ui.paths.create },
    }
  }
  if (toml.ui?.handle !== undefined) {
    ui = { ...ui, ui_extension_handle: toml.ui.handle }
  }

  return {
    title: toml.name,
    module_id: moduleId,
    description: toml.description,
    app_key: context.apiKey,
    api_type: toml.type === 'function' ? undefined : toml.type,
    api_version: toml.api_version,
    input_query: inputQuery,
    input_query_variables: toml.input?.variables
      ? { single_json_metafield: toml.input.variables }
      : undefined,
    ui,
    enable_creation_ui: toml.ui?.enable_create ?? true,
    localization: await loadLocalesConfig(context.directory, 'function'),
    targets,
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['function']`
- `buildConfig`: `{mode: 'function'}`
- `additionalIdentifiers`: `['order_discounts', 'cart_checkout_validation', ...]` (12 additional identifiers)
- `preDeployValidation(instance)`: checks that wasm file exists at `instance.outputPath`.
- `computeHandle(config)`: `config.handle ?? slugify(config.name ?? '')`
- `computeUid(config)`: `config.uid ?? nonRandomUUID(this.computeHandle(config))`

**Complexity:** Multiple async file reads (input.graphql, per-target input queries, locales). Random UUID generation for `module_id`. Field restructuring (ui.paths -> app_bridge, input.variables -> input_query_variables.single_json_metafield). The `readInputQuery` helper throws if the referenced file doesn't exist.

**Key risk:** `randomUUID()` for `module_id` means every deploy generates a new ID. This is intentional per the existing spec — the server uses it as a version identifier, not a stable reference. Parity is guaranteed by checking all other fields (module_id is excluded from parity comparison since it's random).

**Parity test:** Full config with targeting, ui, input. Minimal config without optional fields. Verify file reading works for input queries. Verify localization loading.

---

#### 2.8 `flow_action` — FlowActionModule

**Current spec:** `specifications/flow_action.ts`

**encode():**
```typescript
async encode(toml: FlowActionToml, context: EncodeContext): Promise<FlowActionContract> {
  return {
    title: toml.name,
    description: toml.description,
    url: toml.runtime_url,
    fields: serializeFields('flow_action', toml.settings?.fields),
    validation_url: toml.validation_url,
    custom_configuration_page_url: toml.config_page_url,
    custom_configuration_page_preview_url: toml.config_page_preview_url,
    schema_patch: await loadSchemaFromPath(context.directory, toml.schema),
    return_type_ref: toml.return_type_ref,
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`
- No build, no validation beyond Zod schema refinements.

**Complexity:** Field renames (`name` -> `title`, `runtime_url` -> `url`, `config_page_url` -> `custom_configuration_page_url`). `serializeFields()` transforms the field array into the server format. `loadSchemaFromPath()` reads a JSON schema file from disk. Both are existing utility functions that stay as-is.

**Dependencies:** `services/flow/serialize-fields.ts`, `services/flow/utils.ts` (loadSchemaFromPath). These utilities are shared with flow_trigger and should remain as shared imports.

**Parity test:** With schema file, without schema file. With and without fields. With and without configuration page URLs.

---

#### 2.9 `flow_trigger` — FlowTriggerModule

**Current spec:** `specifications/flow_trigger.ts`

**encode():**
```typescript
async encode(toml: FlowTriggerToml, context: EncodeContext): Promise<FlowTriggerContract> {
  return {
    title: toml.name,
    description: toml.description,
    fields: serializeFields('flow_trigger', toml.settings?.fields),
    schema_patch: await loadSchemaFromPath(context.directory, toml.schema),
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`

**Complexity:** Similar to flow_action but simpler — fewer fields, no URL fields. Same dependencies on `serializeFields` and `loadSchemaFromPath`.

**Parity test:** Same as flow_action pattern.

---

#### 2.10 `flow_template` — FlowTemplateModule

**Current spec:** `specifications/flow_template.ts`

**encode():**
```typescript
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
```

**Other methods:**
- `appModuleFeatures()`: returns `['ui_preview']`
- `buildConfig`: `{mode: 'copy_files', filePatterns: ['*.flow', '*.json', '*.toml']}`

**Complexity:** Field unwrapping from `template.*` to top level. `loadWorkflow()` globs for a `.flow` file and reads it as base64. Localization loading. The `loadWorkflow` helper should move into this module file or a shared flow utility.

**Parity test:** Verify base64 encoding of workflow file. Verify category validation (VALID_CATEGORIES list). With and without optional template fields.

---

#### 2.11 `pos_ui_extension` — PosUIModule

**Current spec:** `specifications/pos_ui_extension.ts`

**encode():**
```typescript
async encode(toml: PosUIToml, context: EncodeContext): Promise<PosUIContract> {
  const result = await getDependencyVersion('@shopify/retail-ui-extensions', context.directory)
  if (result === 'not_found') throw new BugError('Dependency @shopify/retail-ui-extensions not found')
  return {
    name: toml.name,
    description: toml.description,
    renderer_version: result?.version,
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['ui_preview', 'esbuild', 'single_js_entry_path']`
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/retail-ui-extensions'`

**Complexity:** Reads the renderer version from the npm dependency. `getDependencyVersion` reads `package.json` — it is an async function from `models/app/app.ts`. Simple field mapping otherwise.

**Parity test:** Verify renderer_version is read from package.json.

---

#### 2.12 `product_subscription` — ProductSubscriptionModule

**Current spec:** `specifications/product_subscription.ts`

**encode():**
```typescript
async encode(_toml: unknown, context: EncodeContext): Promise<ProductSubscriptionContract> {
  const result = await getDependencyVersion('@shopify/admin-ui-extensions', context.directory)
  if (result === 'not_found') throw new BugError('Dependency @shopify/admin-ui-extensions not found')
  return { renderer_version: result?.version }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `['ui_preview', 'esbuild', 'single_js_entry_path']`
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/admin-ui-extensions'`
- `additionalIdentifiers`: `['subscription_management']`
- `graphQLType`: `'subscription_management'`

**Complexity:** Config is entirely ignored. Output is only the renderer version from package.json. Simpler than pos_ui.

**Parity test:** Verify renderer_version only.

---

### Batch 4: High complexity (3-4 days)

#### 2.13 `payments_extension` — PaymentsModule

**Current spec:** `specifications/payments_app_extension.ts` + 6 sub-schemas

**encode():**
```typescript
async encode(toml: PaymentsToml): Promise<PaymentsContract> {
  const target = toml.targeting[0]?.target
  switch (target) {
    case 'payments.offsite.render':
      return offsitePaymentsAppExtensionDeployConfig(toml as OffsiteConfig)
    case 'payments.redeemable.render':
      return redeemablePaymentsAppExtensionDeployConfig(toml as RedeemableConfig)
    case 'payments.credit-card.render':
      return creditCardPaymentsAppExtensionDeployConfig(toml as CreditCardConfig)
    case 'payments.custom-onsite.render':
      return customOnsitePaymentsAppExtensionDeployConfig(toml as CustomOnsiteConfig)
    case 'payments.custom-credit-card.render':
      return customCreditCardPaymentsAppExtensionDeployConfig(toml as CustomCreditCardConfig)
    case 'payments.card-present.render':
      return cardPresentPaymentsAppExtensionDeployConfig(toml as CardPresentConfig)
    default:
      return {}
  }
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`
- No build. No validation beyond Zod schema refinements.

**Complexity:** 6 payment variants, each with its own field mapping. The deploy config functions are already extracted into separate files under `payments_app_extension_schemas/`. The module calls these existing functions directly. Field renames include: `payment_session_url` -> `start_payment_session_url`, `buyer_label` -> `default_buyer_label`, `buyer_label_translations` -> `buyer_label_to_locale`, etc.

**Key decision:** Keep the 6 existing deploy config functions as-is (they are well-tested) and call them from the module's `encode()`. Do NOT rewrite the field mapping logic.

**Parity test:** One test per payment variant. Use existing test data from `payments_app_extension_schemas/*.test.ts`. Verify all field renames for each variant.

---

### Batch 5: Very high complexity (4-5 days)

#### 2.14 `ui_extension` — UIExtensionModule

**Current spec:** `specifications/ui_extension.ts` — the most complex spec in the codebase (~460 lines)

**encode():**
```typescript
async encode(toml: UIExtensionToml, context: EncodeContext): Promise<UIExtensionContract> {
  const transformedExtensionPoints = toml.extension_points?.map(addDistPathToAssets) ?? []
  return {
    api_version: toml.api_version,
    extension_points: transformedExtensionPoints,
    capabilities: toml.capabilities,
    supported_features: toml.supported_features,
    name: toml.name,
    description: toml.description,
    settings: toml.settings,
    localization: await loadLocalesConfig(context.directory, toml.type),
  }
}
```

**Other methods (all required):**
- `appModuleFeatures(config)`: dynamic — checks if any extension point targets checkout surface, returns `['ui_preview', 'esbuild', 'generates_source_maps']` plus optionally `'cart_url'`.
- `buildConfig`: `{mode: 'ui'}`
- `dependency`: `'@shopify/checkout-ui-extensions'`
- `validate(instance)`: `validateUIExtensionPointConfig()` — checks for missing module files, duplicate targets, missing tools/instructions files. ~60 lines of validation logic.
- `getBundleExtensionStdinContent(instance)`: generates esbuild stdin content from extension points and modules. Handles Remote DOM extensions differently (adds `shopify.extend(...)` wrappers). Generates should-render asset entries.
- `hasExtensionPointTarget(config, target)`: checks if a target exists in extension_points.
- `contributeToSharedTypeFile(instance, map)`: the most complex method — ~150 lines. Three-pass algorithm: (1) collect entry point files and their targets, (2) find all imported files recursively, (3) generate TypeScript type definitions per file. Handles tools type definitions, should-render targets, tsconfig discovery.
- `copyStaticAssets(instance, outputPath)`: copies static assets (tools, instructions) from source to output directory for Remote DOM extensions.
- `devSessionDefaultWatchPaths(instance)`: for UI extensions, returns paths derived from bundle stdin content rather than the entry source file.

**Complexity:** This is the most complex module. The `encode()` itself is straightforward (field passthrough + localization + dist path prefix), but the module has 7 optional capability methods. The `contributeToSharedTypeFile` method alone is ~150 lines with complex async logic.

**Migration strategy:** Move the helper functions (`addDistPathToAssets`, `validateUIExtensionPointConfig`, `isRemoteDomExtension`, `getShouldRenderTarget`, `buildShouldRenderAsset`, `checkForMissingPath`) into the module file. They are only used by this spec.

**Parity test:**
- `encode()`: With and without extension_points. Verify dist path prefixing.
- `validate()`: Missing module file, duplicate targets, missing tools file.
- `getBundleExtensionStdinContent()`: Remote DOM vs legacy. With and without should_render.
- `contributeToSharedTypeFile()`: With multiple extension points sharing files. With tools definitions.
- `copyStaticAssets()`: Static asset copying for Remote DOM extensions.

---

### Additional: Contract-only modules

Two contract-only modules need thin `AppModule` instances:

#### `channel_config` — ChannelConfigModule

**Current spec:** `specifications/channel.ts` — uses `createContractBasedModuleSpecification`

**encode():**
```typescript
async encode(toml: unknown, context: EncodeContext): Promise<unknown> {
  const { type, handle, uid, path, extensions, ...config } = toml as Record<string, unknown>
  return config  // strip first-class fields, passthrough
}
```

**Other methods:**
- `appModuleFeatures()`: returns `[]`
- `buildConfig`: `{mode: 'copy_files', filePatterns: ['specifications/**/*.json', 'specifications/**/*.toml', 'specifications/**/*.yaml', 'specifications/**/*.yml', 'specifications/**/*.svg']}`

**Complexity:** Trivial. Strips metadata fields and passes through.

---

## 3. New Files to Create

All paths relative to `packages/app/src/cli/models/app/app-modules/`.

| File | Module | Batch |
|------|--------|-------|
| `checkout-post-purchase.ts` | CheckoutPostPurchaseModule | 1 |
| `checkout-post-purchase.test.ts` | Tests | 1 |
| `theme.ts` | ThemeModule | 1 |
| `theme.test.ts` | Tests | 1 |
| `checkout-ui.ts` | CheckoutUIModule | 2 |
| `checkout-ui.test.ts` | Tests | 2 |
| `web-pixel.ts` | WebPixelModule | 2 |
| `web-pixel.test.ts` | Tests | 2 |
| `tax-calculation.ts` | TaxCalculationModule | 2 |
| `tax-calculation.test.ts` | Tests | 2 |
| `editor-extension-collection.ts` | EditorExtensionCollectionModule | 2 |
| `editor-extension-collection.test.ts` | Tests | 2 |
| `function.ts` | FunctionModule | 3 |
| `function.test.ts` | Tests | 3 |
| `flow-action.ts` | FlowActionModule | 3 |
| `flow-action.test.ts` | Tests | 3 |
| `flow-trigger.ts` | FlowTriggerModule | 3 |
| `flow-trigger.test.ts` | Tests | 3 |
| `flow-template.ts` | FlowTemplateModule | 3 |
| `flow-template.test.ts` | Tests | 3 |
| `pos-ui.ts` | PosUIModule | 3 |
| `pos-ui.test.ts` | Tests | 3 |
| `product-subscription.ts` | ProductSubscriptionModule | 3 |
| `product-subscription.test.ts` | Tests | 3 |
| `payments.ts` | PaymentsModule | 4 |
| `payments.test.ts` | Tests | 4 |
| `ui-extension.ts` | UIExtensionModule | 5 |
| `ui-extension.test.ts` | Tests | 5 |
| `channel-config.ts` | ChannelConfigModule | 1 |
| `channel-config.test.ts` | Tests | 1 |

### Modified files

| File | Change |
|------|--------|
| `models/app/app-modules/index.ts` | Add all 14+1 new modules to `ALL_MODULES`. |

---

## 4. Testing Strategy

### 4.1 Encode parity tests (every module)

The primary test for each module is encode parity: given the same TOML input, the new `module.encode(toml, context)` produces identical output to the old `spec.deployConfig(config, directory, apiKey, moduleId)`.

**Pattern:**
```typescript
describe('encode parity', () => {
  it('produces identical output to spec.deployConfig', async () => {
    const config = { /* representative TOML config */ }
    const context = { appConfiguration: {...}, directory: '/test', apiKey: 'test-key' }

    const newResult = await module.encode(config, context)
    const oldResult = await oldSpec.deployConfig(config, context.directory, context.apiKey, undefined)

    expect(newResult).toEqual(oldResult)
  })
})
```

For each module, test with:
- Full config (all fields present)
- Minimal config (only required fields)
- Edge cases specific to that module

### 4.2 Method parity tests (modules with optional capabilities)

For modules with `validate`, `preDeployValidation`, `buildValidation`, `getBundleExtensionStdinContent`, etc.:

```typescript
describe('validate parity', () => {
  it('produces same validation result as spec.validate', async () => {
    // Create a ModuleInstance with test config
    const instance = testModuleInstance({ module, config: invalidConfig })
    const newResult = await module.validate(instance)
    // Compare with old spec behavior
  })
})
```

### 4.3 Integration tests

After each batch is merged:
- Run the full CI pipeline.
- Verify `loadApp()` still produces the same instance set.
- Verify deploy produces identical bundles.
- Verify dev session works correctly for the migrated extension types.

### 4.4 Per-module test checklist

| Module | encode | validate | preDeployValidation | buildValidation | getBundleStdin | contributeToSharedType | copyStaticAssets |
|--------|--------|----------|--------------------|-----------------|-----------------|-----------------------|-----------------|
| checkout_post_purchase | x | | | | | | |
| theme | x | | x | | | | |
| checkout_ui | x | | | | | | |
| web_pixel | x | | x | x | | | |
| tax_calculation | x | | | | | | |
| editor_extension_collection | x | | | | | | |
| function | x | | x | | | | |
| flow_action | x | | | | | | |
| flow_trigger | x | | | | | | |
| flow_template | x | | | | | | |
| pos_ui | x | | | | | | |
| product_subscription | x | | | | | | |
| payments | x | | | | | | |
| ui_extension | x | x | | | x | x | x |
| channel_config | x | | | | | | |

---

## 5. Risks and Mitigations

### 5.1 Behavioral divergence in encode()

**Risk:** The new `encode()` produces subtly different output from `spec.deployConfig()` for some edge case, causing deploy failures in production.

**Mitigation:**
- Every module has parity tests comparing old and new output.
- For complex modules (function, payments, ui_extension), test with real-world TOML configs from existing tests.
- During development, temporarily add dual-path verification: run both old spec and new module, assert identical output.
- The old spec remains available as a fallback: if a new module has a bug, the `ExtensionInstance.deployConfig()` path can still delegate to the old spec.

### 5.2 File I/O differences

**Risk:** Modules that read files (function: input.graphql, flow_action: schema, flow_template: .flow files) might handle paths differently when receiving `context.directory` vs the old `directory` parameter.

**Mitigation:**
- `context.directory` is set to the same value as the old `directory` parameter (the extension's directory).
- Add path-specific tests verifying that file reads use the correct base directory.
- The file-reading utility functions (`readFile`, `loadSchemaFromPath`, `loadWorkflow`) are reused unchanged.

### 5.3 Random UUID in function module

**Risk:** The function module's `module_id = randomUUID()` generates a new value on every call. Parity tests cannot compare this field directly.

**Mitigation:**
- Exclude `module_id` from the parity comparison OR mock `randomUUID` in tests.
- Document that `module_id` is intentionally random per deploy.

### 5.4 Zod transforms run before encode()

**Risk:** Some extensions have Zod schema transforms (ui_extension, editor_extension_collection) that restructure data during parsing. The `encode()` method receives the transformed data, not the raw TOML. If the module is moved to AppModule before the Zod schema is removed, the module must handle the transformed shape.

**Mitigation:**
- In Phase 2, the Zod schemas remain in place for TOML parsing. The data flowing into `encode()` is the same transformed shape as before.
- In Phase 4+, when Zod schemas are removed, the modules will need to handle the raw TOML shape. But that is a separate concern.
- Document which modules depend on Zod transforms: `ui_extension` (extension_points + build_manifest), `editor_extension_collection` (inCollection).

### 5.5 Payments module's 6 variants

**Risk:** The payments module dispatches to 6 different deploy config functions. A subtle error in the dispatch or in one variant's field mapping could go unnoticed.

**Mitigation:**
- Reuse the existing deploy config functions from `payments_app_extension_schemas/`. Do NOT rewrite the field mapping.
- One test per variant using existing test data.
- The existing test files (`*_schema.test.ts`) already have comprehensive field mapping tests — verify they still pass.

### 5.6 ui_extension's contributeToSharedTypeFile complexity

**Risk:** The type generation logic (~150 lines, 3-pass async algorithm) is the most complex method in the entire extension system. Moving it could introduce subtle bugs in TypeScript type generation.

**Mitigation:**
- Move the entire function body as-is, changing only the parameter types.
- Keep helper functions (`findAllImportedFiles`, `createTypeDefinition`, `findNearestTsConfigDir`, etc.) as separate imports from `type-generation.ts`.
- Test with existing test cases from `ui_extension.test.ts` and `type-generation.test.ts`.

---

## 6. Definition of Done

Phase 2 is complete when ALL of the following criteria are met:

### Functional criteria

1. **All 14 non-config extension types have dedicated `AppModule` subclasses.**
2. **`channel_config` has a dedicated `AppModule` instance** (contract-only with copy_files build).
3. **Every module's `encode()` produces identical output** to the old `spec.deployConfig()` for all test inputs.
4. **Every module's optional methods** (validate, preDeployValidation, buildValidation, getBundleExtensionStdinContent, contributeToSharedTypeFile, copyStaticAssets) produce identical behavior to the old spec methods.
5. **`ALL_MODULES` registry contains all modules** (9 config + 14 non-config + channel_config = 24+).
6. **All modules are real AppModule subclasses** (no bridge or wrapper modules needed).

### Test criteria

7. **Each of the 14+1 modules has a dedicated test file** with encode parity tests.
8. **Modules with optional capabilities have method-specific tests.**
9. **All existing tests pass** with no behavioral changes.
10. **Full CI pipeline passes.**

### Non-functional criteria

11. **No new runtime dependencies introduced.**
12. **Old spec files still exist** (deleted in Phase 4).
13. **No changes to the public API** of any package.

---

## 7. Effort Estimate

| Batch | Modules | Days | Cumulative |
|-------|---------|------|-----------|
| 1 (Trivial) | checkout_post_purchase, theme, channel_config | 2 | 2 |
| 2 (Low) | checkout_ui, web_pixel, tax_calculation, editor_extension_collection | 6 | 8 |
| 3 (Medium) | function, flow_action, flow_trigger, flow_template, pos_ui, product_subscription | 14 | 22 |
| 4 (High) | payments | 4 | 26 |
| 5 (Very High) | ui_extension | 5 | 31 |

**Total estimated effort: ~31 developer-days** (6-7 weeks for one developer, or 3-4 weeks with two developers working in parallel on different batches).

Each batch can be merged independently. Batches 1-2 can run in parallel since they have no interdependencies. Batch 3 modules are also independent of each other. Batches 4 and 5 should go last due to complexity.
