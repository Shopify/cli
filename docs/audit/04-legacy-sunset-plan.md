# Legacy Flows: Sunset Plan

## Overview

6 legacy flows still run for the 9 config modules that have been migrated to AppModule. Each needs a replacement before the old spec files can be removed.

---

## 1. `contributeToAppConfigurationSchema()`

**What it does:** Each old spec merges its Zod schema into the app-level schema via `getAppVersionedSchema()` (`app.ts:178`). This merged schema validates the full TOML during initial loading — catches type errors, missing required fields, invalid URLs, etc. before any module-level extraction runs.

**Why it matters:** Without this, a malformed TOML (e.g., `embedded = "yes"` instead of `embedded = true`) would pass initial loading and only fail later during encode or on the server.

**Sunset approach:** AppModules could contribute to the app-level schema. Add an optional `contributeSchema` to the AppModule interface:

```typescript
interface AppModule<TToml, TContract> {
  // ... existing fields ...

  /** Optional: contribute keys to the app-level Zod schema for early TOML validation. */
  appSchema?: Record<string, ZodType>
}
```

`getAppVersionedSchema()` would iterate `allAppModules` and merge `appSchema` entries into the base schema, replacing the old `spec.contributeToAppConfigurationSchema()` call.

For config modules, `appSchema` would be the module's TOML keys with their types:
```typescript
// branding
appSchema: {
  name: zod.string().max(30),
  handle: zod.string().max(256).optional(),
}
```

**Alternative:** Skip app-level Zod validation for modules with contracts. The contract validates post-encode. TOML-level type errors would surface as contract validation errors instead of Zod errors — slightly worse error messages (contract errors are less human-friendly) but functionally equivalent.

**Parity:** Either approach maintains validation. The first gives identical error messages. The second changes error formatting but catches the same issues.

**Effort:** Small for `appSchema` approach. The schemas are simple key-type declarations — no transforms, no base field inheritance.

---

## 2. `patchWithAppDevURLs()`

**What it does:** During `dev` command, injects tunnel URLs into `this.configuration` by mutating it in place. Three modules use it:
- `app_home`: sets `config.application_url = urls.applicationUrl`
- `app_access`: sets `config.auth = {redirect_urls: urls.redirectUrlWhitelist}`
- `app_proxy`: sets `config.app_proxy = {url, subpath, prefix}` from proxy URLs

**Why it matters:** Dev mode needs tunnel URLs. Without patching, dev sessions would use the TOML URLs instead of the tunnel.

**Sunset approach:** Add `patchForDev` to AppModule:

```typescript
interface AppModule<TToml, TContract> {
  // ... existing fields ...

  /** Mutate extracted config with dev tunnel URLs. Dev mode only. */
  patchForDev?(config: TToml, urls: ApplicationURLs): void
}
```

Move the logic from old spec `patchWithAppDevURLs` into AppModule `patchForDev`. The callsite in `ExtensionInstance.patchWithAppDevURLs()` delegates to the AppModule if present.

**Parity:** Identical behavior. Same mutation on same data. The config shape is the same (module-specific keys only) — verified that `application_url`, `auth.redirect_urls`, and `app_proxy` are all in the extracted data.

**Effort:** Small. Three modules, straightforward move.

---

## 3. `getDevSessionUpdateMessages()`

**What it does:** Returns user-facing messages during dev sessions. Three modules use it:
- `app_home`: returns application URL info
- `app_access`: returns scope auto-grant messages, legacy install flow warnings
- `app_proxy`: returns proxy URL info

**Why it matters:** Developer experience during `dev` — informational messages in the terminal.

**Sunset approach:** Add `devMessages` to AppModule:

```typescript
interface AppModule<TToml, TContract> {
  // ... existing fields ...

  /** Return messages to display during dev sessions. */
  devMessages?(config: TToml): Promise<string[]>
}
```

Move from old spec `getDevSessionUpdateMessages` into AppModule `devMessages`.

**Parity:** Identical messages. Same logic, same inputs.

**Effort:** Small. Three modules.

---

## 4. `unifiedConfigurationParserFactory` still created for migrated modules

**What it does:** `fetch-extension-specifications.ts:96` creates a unified parser for every spec that has a contract. For the 9 config modules, this parser is created but never used — the loader uses AppModule extraction instead. The parser creation involves normalizing the JSON Schema, compiling with AJV, etc.

**Why it matters:** Wasted work at app load time. Not a correctness issue.

**Sunset approach:** Skip unified parser creation for modules that have an AppModule. In `fetch-extension-specifications.ts`, after merging local + remote specs:

```typescript
const appModuleIds = new Set(allAppModules.map(m => m.identifier))
// Only create unified parser for specs WITHOUT an AppModule
if (!appModuleIds.has(merged.identifier)) {
  const parseConfigurationObject = await unifiedConfigurationParserFactory(merged, handleInvalidAdditionalProperties)
  return { ...merged, parseConfigurationObject }
}
return merged
```

**Parity:** No behavior change. The unified parser was already unused for AppModule modules.

**Effort:** Small. A few lines in one file.

---

## 5. `write-app-configuration-file.ts`

**What it does:** Writes app config back to TOML. Two legacy dependencies:
1. `reduceWebhooks()` — condenses compliance + non-compliance subscriptions into unified entries
2. `rewriteConfiguration()` — walks the Zod schema tree to determine TOML field ordering

**Why it matters:** `app config link` and config writing need correct TOML output.

**Sunset approach:**

For `reduceWebhooks`: This is a data utility, not a transform. It merges webhook subscriptions with the same URI. Extract it from `transform/app_config_webhook.ts` into a shared utility (e.g., `app-modules/utils/webhook-merge.ts`). No behavior change.

For `rewriteConfiguration` (Zod schema walking): This is harder. The function uses the Zod schema's `.shape` to determine which fields to write and in what order. Two options:

a) **AppModule declares field ordering.** Add `tomlFieldOrder?: string[]` to AppModule. The writer uses this instead of walking the Zod schema.

b) **Keep a minimal Zod schema for ordering only.** Separate the "TOML structure definition" (used for ordering) from the "validation schema" (used for validation). The ordering schema is a simple structure declaration with no transforms, no refinements.

c) **Don't enforce ordering.** Let TOML fields write in natural order. Simpler but changes TOML output formatting.

**Parity:** (a) and (b) maintain identical output. (c) changes formatting.

**Effort:** Medium. The `rewriteConfiguration` function is complex (handles nested schemas, arrays, effects).

---

## 6. Old spec files still exist

**What it does:** The 9 `app_config_*.ts` files and their `transform/*.ts` helpers are still loaded and registered. `ExtensionInstance` constructor requires a `specification` reference.

**Why it matters:** Can't delete the files until `ExtensionInstance` doesn't need them.

**Sunset approach:** Create minimal spec stubs. The full spec has: schema, transforms, identifier, uidStrategy, graphQLType, externalIdentifier, buildConfig, appModuleFeatures, patchWithAppDevURLs, getDevSessionUpdateMessages, etc. Most of this is now on AppModule or can be derived from it.

A minimal spec would keep only what `ExtensionInstance` reads from `this.specification`:
- `identifier` — from AppModule
- `graphQLType` — could move to AppModule or be derived
- `externalIdentifier`, `externalName`, `additionalIdentifiers` — metadata, move to AppModule
- `uidStrategy` — already on AppModule
- `buildConfig` — not relevant for config modules (all use `{mode: 'none'}`)
- `registrationLimit` — comes from remote spec, keep on merged spec
- `experience` — `'configuration'` for all config modules

The minimal spec can be generated FROM the AppModule + remote spec metadata:

```typescript
function specFromAppModule(appModule: AppModule, remoteSpec: FlattenedRemoteSpecification): ExtensionSpecification {
  return {
    identifier: appModule.identifier,
    uidStrategy: appModule.uidStrategy,
    experience: 'configuration',
    schema: zod.any(),  // not used for validation anymore
    // ... other metadata from remoteSpec
    parseConfigurationObject: (obj) => ({state: 'ok', data: obj, errors: undefined}),
    contributeToAppConfigurationSchema: (schema) => schema,  // no-op if using appSchema
  }
}
```

**Parity:** `ExtensionInstance` works identically — it reads the same metadata. Transforms and schema are no longer used (AppModule handles those).

**Effort:** Large. `ExtensionInstance` has many properties and methods that read `this.specification.*`. Need to audit every access to ensure the minimal stub provides what's needed. But this is the gate — once this works, the old spec files and all their transform infrastructure can be deleted.

---

## Sunset Order

| Step | What | Blocks |
|------|------|--------|
| **A** | Skip unified parser for AppModule modules (#4) | Nothing — pure optimization |
| **B** | Move `patchForDev` + `devMessages` to AppModule (#2, #3) | Nothing — additive |
| **C** | Add `appSchema` to AppModule, replace `contributeToAppConfigurationSchema` (#1) | Nothing — additive |
| **D** | Extract `reduceWebhooks` to shared utility (#5 partial) | Nothing |
| **E** | Add `tomlFieldOrder` or minimal schema for TOML writer (#5 complete) | Nothing |
| **F** | Generate minimal spec stubs from AppModule (#6) | Steps B, C (must be off old spec first) |
| **G** | Delete old spec files, transform helpers, factory functions | Step F |

Steps A-E are independent and can be done in any order. Step F requires B and C. Step G requires F.

After step G, the old infrastructure is gone: `createConfigExtensionSpecification`, `TransformationConfig`, `CustomTransformationConfig`, `resolveAppConfigTransform`, `appConfigTransform`, `defaultAppConfigReverseTransform`, and the 9 spec files + their transform helpers.
