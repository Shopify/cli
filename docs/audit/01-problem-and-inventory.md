# Current State: How TOML Flows Through the CLI

## The Full Pipeline

```
shopify.app.toml (text)
     │
     ▼
decodeToml()                          → Record<string, unknown>
     │
     ▼
getAppVersionedSchema().safeParse()   → AppConfiguration (typed, but passthrough allows unknowns)
     │
     ▼
For each single-UID spec:
  spec.parseConfigurationObject(fullConfig)
    → Zod extracts this module's fields (strips the rest)
    → Contract validates (strip mode) — CATEGORY ERROR: validates TOML against API shape
    → Returns stripped data as this.configuration
     │
     ▼
Hardcoded: createWebhookSubscriptionInstances()
    → Parses webhooks section again with WebhooksSchema
    → Splits subscriptions into individual instances
     │
     ▼
deployConfig()
    → transformLocalToRemote() reshapes TOML → contract format
    → OR spec.deployConfig() strips metadata and sends as-is
     │
     ▼
bundleConfig()
    → JSON.stringify, add handle/uuid/context wrapper
     │
     ▼
GraphQL mutation → server
```

## What Owns What Today

### File-level: No single owner

The "file" is handled by multiple uncoordinated pieces:

| Concern | Where | How |
|---------|-------|-----|
| TOML type | `AppConfigurationUsedByCli` (`types/app_config.ts`) | Manual interface, incomplete, marked "you probably don't need to update" |
| Base schema | `AppSchema` (`app.ts:112-123`) | Only `client_id`, `build`, `extension_directories`, `web_directories` |
| Full schema | `getAppVersionedSchema()` (`app.ts:173-185`) | Built dynamically by merging each spec's schema, then `.passthrough()` |
| Module extraction | `createConfigExtensionInstances()` (`loader.ts:733`) | Passes full config to each spec's parser |
| Webhook extraction | `createWebhookSubscriptionInstances()` (`loader.ts:703`) | Hardcoded, separate from the spec system |
| Orchestration | `loadExtensions()` (`loader.ts:607-619`) | Calls three separate methods, merges results |

**Problem:** There is no single interface that represents the decoded TOML file. The full type is assembled dynamically from specs, the extraction logic is split across two methods (one generic, one hardcoded), and the type system uses `.passthrough()` which erases type safety for module fields.

### Module-level: ExtensionSpecification (too general)

Each config module is an `ExtensionSpecification` — the same interface used for functions, UI extensions, payments, themes, etc. The config-module-specific behavior is layered on through:

| Concern | Where | How |
|---------|-------|-----|
| TOML shape | Zod schema on the spec | `BaseSchemaWithoutHandle.extend({...})` per module |
| Extraction | `parseConfigurationObject()` on the spec | Zod's default object stripping |
| Forward transform | `transformLocalToRemote` on the spec | Set by `resolveAppConfigTransform()` from `TransformationConfig` or `CustomTransformationConfig` |
| Reverse transform | `transformRemoteToLocal` on the spec | Set by `resolveReverseAppConfigTransform()` — defined separately from forward |
| Contract validation | `unifiedConfigurationParserFactory()` | Runs on TOML shape, returns contract-stripped data (the bug) |
| Deploy | `deployConfig()` on `ExtensionInstance` | Calls `transformLocalToRemote` or `spec.deployConfig()` |

**Problem:** The spec interface doesn't distinguish between "extracting my data from the TOML" and "validating/transforming my data." It doesn't define bidirectional transforms as a unit. It doesn't declare which TOML keys it claims. And three webhook-related modules share the same schema, with no explicit handling of the overlap.

## Extraction: How Modules Get Their Data

### single-UID modules (8 of the 9 config modules)

`createConfigExtensionInstances()` at `loader.ts:733-761`:

```
for each spec where uidStrategy === 'single':
  specConfiguration = spec.parseConfigurationObject(fullAppConfig)
  if specConfiguration is empty → skip
  create ExtensionInstance with specConfiguration
```

`parseConfigurationObject` is either:
- **Zod-only** (no contract): `schema.safeParse(fullAppConfig)` → Zod strips fields it doesn't declare
- **Unified** (has contract): Zod first, then contract validation with `strip` mode → returns contract-stripped data

For Zod-only: extraction = Zod's object stripping. Correct.
For unified: extraction = contract's stripping. **Wrong when contract has different field names.**

### dynamic-UID module (webhook_subscription)

`createWebhookSubscriptionInstances()` at `loader.ts:703-731`:

```
parse fullAppConfig with WebhooksSchema → get webhooks.subscriptions
for each subscription:
  destructure {uri, topics, compliance_topics: _, ...rest}  ← note: compliance_topics discarded
  for each topic in topics:
    create ExtensionInstance with {api_version, uri, topic, ...rest}
```

This is **hardcoded in the loader**. It's not driven by the spec's `parseConfigurationObject`. It manually destructures the webhooks object, splits by topic, and discards compliance_topics (which belong to the `privacy_compliance_webhooks` module).

### Shared TOML keys

The `webhooks` key is claimed by three modules:

| Module | Schema | What it extracts | How |
|--------|--------|-----------------|-----|
| `webhooks` | `WebhooksSchema` | `api_version` only | Forward transform: `{webhooks: {api_version}} → {api_version}` |
| `privacy_compliance_webhooks` | `WebhooksSchema` (same!) | Compliance subscription URIs | Forward transform: finds compliance_topics subscriptions |
| `webhook_subscription` | `SingleWebhookSubscriptionSchema` | Individual subscriptions | Hardcoded loader method splits the array |

All three receive the full `webhooks` object from Zod. The transform layer selects which parts each module owns. There is no explicit declaration of ownership.

Other potential overlaps:
- `name` is in `BaseSchema` and claimed by `branding`'s transform
- `embedded` is at top level (claimed by `app_home`) and nested in `pos.embedded` (claimed by `point_of_sale`) — no actual collision

## Transforms: Two Mechanisms, One Purpose

Both reshape TOML → contract format, resolved through different code paths:

### Mechanism A: TransformationConfig (declarative path map)

```typescript
// specification.ts:26-28
interface TransformationConfig {
  [serverField: string]: string  // serverField → tomlPath
}

// Example: app_access
{
  scopes: 'access_scopes.scopes',           // unnest
  redirect_url_allowlist: 'auth.redirect_urls',  // unnest + rename
}
```

Resolved by `resolveAppConfigTransform()` (line 289-294) into a function via `appConfigTransform()` (line 334-349). Bidirectional: same map, reversed with a boolean flag.

Used by: app_access, app_home, branding, point_of_sale.

### Mechanism B: CustomTransformationConfig (forward/reverse functions)

```typescript
// specification.ts:30-32
interface CustomTransformationConfig {
  forward?: (obj: object, appConfiguration: AppConfigurationWithoutPath) => object
  reverse?: (obj: object) => object
}
```

Forward and reverse defined separately. Can diverge.

Used by: webhooks, webhook_subscription, privacy_compliance, app_proxy, events.

### Structural Zod transform (leaked concern)

`mergeAllWebhooks` in `webhooks_schema.ts:21` runs during parsing (before extraction or transforms). Deduplicates, sorts, splits multi-topic subscriptions. This is a structural transform hiding in the validation layer.

## The Category Error (the bug)

`unifiedConfigurationParserFactory` (`utilities/json-schema.ts:34-90`):

1. Zod validates TOML shape → produces TOML-shaped data (correct)
2. Contract validates the same TOML-shaped data against API-shaped schema (wrong — the contract defines the contract/API boundary, not the TOML boundary)
3. In `strip` mode, contract removes all TOML fields it doesn't recognize → produces `{}`
4. Returns `{}` as the module's configuration → stored on ExtensionInstance
5. `deployConfig()` transforms `{}` → `{}` → server receives empty config

**For modules without transforms** (contract-only modules like `data`): TOML = contract format, so the validation is at the right boundary and stripping is the extraction mechanism. This case works correctly.

## Code Locations

### Extraction
| File | What |
|------|------|
| `loader.ts:733-761` | `createConfigExtensionInstances()` — generic extraction for single-UID modules |
| `loader.ts:703-731` | `createWebhookSubscriptionInstances()` — hardcoded webhook extraction |
| `loader.ts:607-619` | `loadExtensions()` — orchestrates both |

### Validation
| File | What |
|------|------|
| `specification.ts:220-234` | `parseConfigurationObject()` — Zod validation per spec |
| `utilities/json-schema.ts:34-90` | `unifiedConfigurationParserFactory()` — Zod + contract (category error) |
| `cli-kit/.../json-schema.ts:60-105` | `jsonSchemaValidate()` — AJV with strip/fail modes |

### Transforms
| File | What |
|------|------|
| `specification.ts:245-268` | `createConfigExtensionSpecification()` — wires transforms |
| `specification.ts:289-349` | `resolveAppConfigTransform()`, `appConfigTransform()` — dispatch + execute |
| `extension-instance.ts:213-223` | `deployConfig()` — calls `transformLocalToRemote()` |
| `select-app.ts:56-75` | `remoteAppConfigurationExtensionContent()` — calls `transformRemoteToLocal()` |
| Each `app_config_*.ts` file | Transform config definitions |

### Types
| File | What |
|------|------|
| `app.ts:112-123` | `AppSchema` — base app fields only |
| `app.ts:163` | `CurrentAppConfiguration` — base + `AppConfigurationUsedByCli` |
| `app.ts:173-185` | `getAppVersionedSchema()` — builds full schema dynamically |
| `types/app_config.ts` | `AppConfigurationUsedByCli` — manual, incomplete TOML type |
| `types/app_config_webhook.ts` | `WebhooksConfig`, `WebhookSubscription` — webhook types |

## Summary of Gaps

1. **No file-level interface.** The decoded TOML has no single owner. Type, extraction, and orchestration are scattered across `app.ts`, `loader.ts`, and `types/app_config.ts`.

2. **No explicit extraction.** Modules don't declare which keys they claim. Zod implicitly strips, the contract implicitly strips, and webhooks are hardcoded in the loader.

3. **No bidirectional transform.** Forward (`transformLocalToRemote`) and reverse (`transformRemoteToLocal`) are defined separately and can diverge.

4. **Validation at wrong boundary.** Contract validation runs on TOML-shaped data pre-transform. For modules with transforms, this is a category error.

5. **Shared keys have no model.** Three modules claim `webhooks` with no explicit ownership declaration. One uses a hardcoded loader method; the other two use the same Zod schema.

6. **Two transform mechanisms.** `TransformationConfig` and `CustomTransformationConfig` serve the same purpose through different code paths.
