# Phase 4: Delete Old Infrastructure

## Prerequisite

Phases 1-3 must be complete. All modules (config + non-config) are on AppModule. All callsites use ModuleInstance. No code references ExtensionInstance or ExtensionSpecification for behavior.

## What to Delete

### Core infrastructure
| File/Code | What | Why it's safe to delete |
|-----------|------|------------------------|
| `ExtensionSpecification` interface in `specification.ts` | The 30+ property god interface | All behavior now on AppModule. Remote metadata on RemoteModuleMetadata. |
| `createExtensionSpecification()` in `specification.ts` | General spec factory | Replaced by AppModule subclasses |
| `createConfigExtensionSpecification()` in `specification.ts` | Config module factory | Replaced by AppModule subclasses |
| `createContractBasedModuleSpecification()` in `specification.ts` | Contract-only module factory | Replaced by base AppModule instances |
| `TransformationConfig` type in `specification.ts` | Declarative path map type | Replaced by AppModule.encode() |
| `CustomTransformationConfig` type in `specification.ts` | Forward/reverse function type | Replaced by AppModule.encode()/decode() |
| `resolveAppConfigTransform()` in `specification.ts` | Dispatch between declarative/custom | Eliminated — one encode() method |
| `resolveReverseAppConfigTransform()` in `specification.ts` | Reverse dispatch | Eliminated — one decode() method |
| `appConfigTransform()` in `specification.ts` | Declarative path mapping executor | Logic moved into individual AppModule.encode() methods |
| `defaultAppConfigReverseTransform()` in `specification.ts` | Default reverse via Zod schema walking | Replaced by explicit decode() methods |
| `configWithoutFirstClassFields()` in `specification.ts` | Metadata stripping | extractByKeys already excludes metadata |
| `ExtensionInstance` class in `extension-instance.ts` | The 400+ line god class | Replaced by ModuleInstance |
| `CONFIG_EXTENSION_IDS` in `extension-instance.ts` | Hardcoded identifier array | Replaced by `ALL_MODULES.filter(m => m.tomlKeys)` |
| `AppLoader` class in `loader.ts` | The 900+ line god class | Replaced by loading functions |
| `unifiedConfigurationParserFactory()` in `utilities/json-schema.ts` | Zod + contract validation chain | Replaced by post-encode contract validation on ModuleInstance |
| `contributeToAppConfigurationSchema()` | Dynamic schema merging | Eliminated — contracts validate, not merged Zod |
| `getAppVersionedSchema()` in `app.ts` | Builds merged app schema | Eliminated — AppTomlFile validates only client_id |

### Config module spec files (9 files + helpers)
| File | Replaced by |
|------|------------|
| `specifications/app_config_app_access.ts` | `app-modules/app-access.ts` |
| `specifications/app_config_app_home.ts` | `app-modules/app-home.ts` |
| `specifications/app_config_branding.ts` | `app-modules/branding.ts` |
| `specifications/app_config_point_of_sale.ts` | `app-modules/point-of-sale.ts` |
| `specifications/app_config_webhook.ts` | `app-modules/webhooks.ts` |
| `specifications/app_config_webhook_subscription.ts` | `app-modules/webhook-subscription.ts` |
| `specifications/app_config_privacy_compliance_webhooks.ts` | `app-modules/privacy-compliance-webhooks.ts` |
| `specifications/app_config_app_proxy.ts` | `app-modules/app-proxy.ts` |
| `specifications/app_config_events.ts` | `app-modules/events.ts` |
| `specifications/transform/app_config_webhook.ts` | Logic in webhooks/privacy-compliance encode/decode |
| `specifications/transform/app_config_events.ts` | Logic in events encode/decode |

### Non-config extension spec files (14 files)
Each replaced by an AppModule subclass in Phase 2. Delete the old spec files once the AppModule version is verified.

### Types and schemas that may remain
| File | Status |
|------|--------|
| `specifications/types/app_config.ts` (`AppConfigurationUsedByCli`) | Review — may still be needed for cross-module data in EncodeContext |
| `specifications/types/app_config_webhook.ts` (`WebhooksConfig`, `WebhookSubscription`) | Review — used by webhook AppModules. Move to app-modules/ if still needed |
| `specifications/app_config_webhook_schemas/` | Review — WebhooksSchema used by app-level validation. May be kept if needed or moved |
| `specifications/validation/common.ts` (`removeTrailingSlash`, etc.) | Utility functions — keep, possibly move to shared utils |
| `specifications/validation/url_prepender.ts` | Used by AppModule encode — keep |
| `schemas.ts` (`BaseSchema`, `BaseSchemaWithoutHandle`) | Review — may still be needed for extension TOML parsing or can be simplified |

## Deletion Order

1. Delete `CONFIG_EXTENSION_IDS` (replace with derived from ALL_MODULES)
2. Delete `createConfigExtensionSpecification`, `TransformationConfig`, `CustomTransformationConfig`, transform helpers
3. Delete the 9 config module spec files + transform/ helpers
4. Delete `createContractBasedModuleSpecification`
5. Delete non-config spec files (after Phase 2 verifies their AppModule replacements)
6. Delete `ExtensionInstance` class
7. Delete `ExtensionSpecification` interface (or reduce to `RemoteModuleMetadata`)
8. Delete `AppLoader` class
9. Delete `unifiedConfigurationParserFactory`, `contributeToAppConfigurationSchema`, `getAppVersionedSchema`
10. Clean up unused imports, types, test helpers

## Verification

After each deletion step, run the full test suite. The expectation is that after Phases 1-3, nothing references the deleted code — deletion should be clean removal with no test failures.

If tests fail after deletion, it means Phase 2 or 3 missed a reference. Fix the reference first, then delete.

## Definition of Done

- Zero references to `ExtensionSpecification`, `ExtensionInstance`, `AppLoader`, `TransformationConfig`, `CustomTransformationConfig` in production code
- All spec files in `specifications/` are either deleted or converted to AppModule subclasses
- `unifiedConfigurationParserFactory`, `contributeToAppConfigurationSchema`, `getAppVersionedSchema` deleted
- Full test suite passes
- No behavioral regressions
