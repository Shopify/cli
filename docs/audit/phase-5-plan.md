# Phase 5: Per-Module Format Convergence

## Prerequisite

Phases 1-4 complete. All modules on AppModule. Old infrastructure deleted. Every module has `encode()` and optionally `decode()`.

## Goal

For each module, align the TOML format with the contract format. When they match, the module's `encode()` becomes a passthrough (identity function) and can be deleted. The module becomes a base `AppModule` instance with no overrides — the CLI just validates against the contract and sends.

## What "Convergence" Means

Today, many modules have TOML fields that differ from contract fields:

| Module | TOML | Contract | Difference |
|--------|------|----------|-----------|
| branding | `handle` | `app_handle` | Rename |
| app_access | `access_scopes.scopes` | `scopes` | Unnest |
| app_access | `auth.redirect_urls` | `redirect_url_allowlist` | Unnest + rename |
| app_home | `application_url` | `app_url` | Rename |
| app_home | `app_preferences.url` | `preferences_url` | Unnest + rename |
| point_of_sale | `pos.embedded` | `embedded` | Unnest |
| webhooks | `webhooks.api_version` | `api_version` | Unnest |
| webhook_subscription | `topics: [...]` (array) | `topic` (singular) | Format change |
| app_proxy | `app_proxy.url` (relative) | `url` (absolute) | Unnest + URL resolution |
| privacy_compliance | `compliance_topics` subscriptions | `customers_redact_url` etc. | Structural + rename |

Convergence means eliminating these differences. For each module, either:
- **The contract changes** to accept the TOML field names (server work), OR
- **The TOML format changes** to match the contract (breaking change for developers)

## Per-Module Convergence Direction

This requires a decision per module, made jointly with the server team. The table below is a recommendation, not a decision.

| Module | Recommended direction | Rationale | Server effort | Developer impact |
|--------|----------------------|-----------|--------------|-----------------|
| branding | Contract accepts `handle` | `handle` is clearer than `app_handle` | Small | None |
| app_access | Contract accepts nested | `access_scopes.scopes` is well-established TOML format | Large | None |
| app_home | Contract accepts TOML names | `application_url` is the established name | Medium | None |
| point_of_sale | Contract accepts nested | `pos.embedded` is clear | Small | None |
| webhooks | Contract accepts nested | `webhooks.api_version` is the TOML format | Small | None |
| webhook_subscription | Contract accepts `topics[]` | Plural array is the TOML format | Medium | None |
| app_proxy | Server resolves relative URIs | Server already knows `application_url` | Medium | None |
| privacy_compliance | Contract accepts TOML format | Most complex — dual format support | Large | None |
| events | Already converged | Forward encode is identity | None | None |

## Process Per Module

1. **Server team updates the contract** to accept TOML field names (the contract's dry-rb definition changes)
2. **Server team adds/updates the Core plugin** to transform from TOML format to internal format
3. **Server deploys** — now accepts both old (post-CLI-transform) and new (TOML) formats
4. **CLI deletes `encode()` override** — the module falls back to base class passthrough
5. **CLI deletes `decode()` override** — if the server stores TOML format, decode is also identity
6. **Old CLI versions continue to work** — server still accepts the old format

## Events: Already Converged

The `events` module's `encode()` is already an identity function (passthrough). Its `decode()` only strips a server-managed `identifier` field. Once the server stops sending `identifier` in link responses (or the CLI ignores it generically), the events module can become a plain `AppModule({identifier: 'events', uidStrategy: 'single', tomlKeys: ['events']})`.

## Timeline

This phase is not time-boxed. Each module converges independently. The server team controls the pace. The CLI team's only action is deleting encode/decode overrides once the server accepts the TOML format.

## End State

Every module is either:
- A base `AppModule` instance with no overrides (TOML = contract)
- An `AppModule` subclass with only `build()` / `getDevProcess()` / `patchForDev()` overrides (behavior, not data transformation)

No `encode()` overrides that rename or restructure fields. The CLI is a thin pipe: extract from TOML, validate against contract, send to server. The contract JSON Schema can be used for IDE autocomplete.

## Definition of Done

For a single module: the `encode()` override is deleted, the base class passthrough is used, and all deploy/dev/link flows work correctly with the TOML-format data going directly to the server.

For all modules: no `encode()` override does field renaming, unnesting, or restructuring. Only async I/O (file reading, localization loading) remains in `encode()` for modules that need it.
