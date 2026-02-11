# Session & Token Management Design

> **Date:** 2026-02-10
> **Context:** Part of the unified API initiative. See [API_AUDIT.md](./API_AUDIT.md), [API_NORTH_STAR.md](./API_NORTH_STAR.md).
> **Purpose:** Unify session and token management behind a single interface. Ships independently, ahead of the API client pipeline.

---

## Why This Ships First

The credential provider interface is the seam between "how do I get a token" and "how do I use a token." Today that seam is implicit -- `ensureAuthenticatedPartners()` returns a string, `partnersRequestDoc()` accepts a string. The credential provider formalizes this into a composable, testable, swappable interface.

This work has **zero dependency on the middleware pipeline** proposed in the north star. It uses the existing HTTP infrastructure (`shopifyFetch`, `graphqlRequestDoc`, Bottleneck rate limiting) unchanged. The existing `ensureAuthenticated*()` public functions keep their signatures. Callers don't change. Only the internals are restructured.

When the pipeline ships later, its auth middleware becomes a new consumer of the same `CredentialProvider` interface. Nothing in this design changes.

---

## Problems With the Current System

1. **Duplicated credential resolution.** The check for `SHOPIFY_CLI_PARTNERS_TOKEN` is copy-pasted across `ensureAuthenticatedPartners()`, `ensureAuthenticatedAppManagementAndBusinessPlatform()`, and `ensureAuthenticatedBusinessPlatform()`. Each has slightly different logic.

2. **No concurrent refresh deduplication.** If `AppManagementClient` and `BusinessPlatformClient` both detect expired tokens simultaneously, both call `ensureAuthenticatedAppManagementAndBusinessPlatform({ forceRefresh: true })` independently. Two identity refreshes, two rounds of five token exchanges, one of which is wasted.

3. **The state machine is monolithic.** `ensureAuthenticated()` in `private/node/session.ts` is a 80-line function that handles validation, refresh, device auth fallback, persistence, and custom token override in one interleaved flow. Hard to test, hard to extend.

4. **No test seam.** Tests that touch auth must `vi.mock('@shopify/cli-kit/node/session')` to replace the entire module. There's no way to inject fake credentials without module patching.

5. **Token types handled with one-off conditionals.** Theme Access passwords (`shptka_*`), custom CLI tokens, identity env tokens, and OAuth sessions are each handled with inline `if` checks scattered across the public session functions.

---

## Design: Three Components

```
┌──────────────────────────────────────────────────┐
│  CredentialProvider chain                         │  Answers: "how do I get a token for this API?"
│  (env var → theme access → oauth session)         │  Strategy pattern. Swappable for test/dev/prod.
├──────────────────────────────────────────────────┤
│  SessionCoordinator                               │  Answers: "is my session valid? do I need to refresh?"
│  (validate → refresh → re-auth → persist)         │  State machine. Owns the token family lifecycle.
├──────────────────────────────────────────────────┤
│  IdentityClient                                   │  Answers: "how do I talk to accounts.shopify.com?"
│  (device auth, token exchange, refresh)            │  HTTP-level. Uses shopifyFetch() directly.
└──────────────────────────────────────────────────┘
```

**No pipeline dependency.** The `IdentityClient` makes HTTP calls to `accounts.shopify.com` using the existing `shopifyFetch()`, exactly as `exchange.ts` and `device-authorization.ts` do today. No middleware, no new transport layer required.

**Consumers don't change.** The existing `ensureAuthenticatedPartners()` etc. functions keep their signatures. They become thin wrappers that call `credentialProvider.getToken(audience)` internally.

---

## Component 1: CredentialProvider

Inspired by AWS SDK v3's credential chain and Azure Identity's `ChainedTokenCredential`. Each provider either returns a token or returns `null` to say "not me, try next." Throwing means "this is my job but something went wrong."

### Interface

```typescript
// packages/cli-kit/src/public/node/api/auth/credential-provider.ts

interface CredentialProvider {
  readonly name: string
  getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null>
}

type ApiAudience =
  | 'admin'
  | 'partners'
  | 'storefront-renderer'
  | 'business-platform'
  | 'app-management'

interface TokenContext {
  /** Required for admin audience (store-scoped tokens). */
  storeFqdn?: string
  /** Additional scopes beyond defaults. */
  extraScopes?: string[]
  /** Force refresh even if cached token is valid. */
  forceRefresh?: boolean
  /** If true, throw instead of prompting for device auth. */
  noPrompt?: boolean
}
```

### Chain Composition

```typescript
function chainProviders(...providers: CredentialProvider[]): CredentialProvider {
  return {
    name: `Chain(${providers.map(p => p.name).join(', ')})`,
    async getToken(audience, context) {
      for (const provider of providers) {
        const token = await provider.getToken(audience, context)
        if (token !== null) return token
      }
      return null
    },
  }
}
```

### Default Chain

```typescript
function createDefaultCredentialProvider(options?: {
  password?: string
}): CredentialProvider {
  return chainProviders(
    new EnvTokenProvider(),            // 1. SHOPIFY_CLI_PARTNERS_TOKEN → exchange for any audience
    ...(options?.password
      ? [new ThemeAccessProvider(options.password)]
      : []),                           // 2. shptka_* passwords → admin audience only
    new IdentityEnvProvider(),         // 3. SHOPIFY_CLI_IDENTITY_TOKEN → exchange for any audience
    new OAuthSessionProvider(
      new SessionCoordinator()
    ),                                 // 4. Disk-cached OAuth session with refresh
  )
}
```

**Precedence:** Env vars win (CI/CD sets them explicitly). Theme access passwords win over OAuth (user explicitly provided one). OAuth session is the fallback for interactive use.

### Provider Implementations

#### `EnvTokenProvider`

Extracts the `SHOPIFY_CLI_PARTNERS_TOKEN` handling currently duplicated across 3+ `ensureAuthenticated*` functions.

```typescript
class EnvTokenProvider implements CredentialProvider {
  readonly name = 'EnvToken'

  async getToken(audience: ApiAudience): Promise<string | null> {
    const partnersToken = process.env.SHOPIFY_CLI_PARTNERS_TOKEN
    if (!partnersToken) return null

    // Exchange the CLI token for the requested audience.
    // Uses existing exchange functions from exchange.ts via IdentityClient.
    if (audience === 'partners') {
      const { accessToken } = await exchangeCustomPartnerToken(partnersToken)
      return accessToken
    }
    if (audience === 'app-management') {
      const { accessToken } = await exchangeCliTokenForAppManagementAccessToken(partnersToken)
      return accessToken
    }
    if (audience === 'business-platform') {
      const { accessToken } = await exchangeCliTokenForBusinessPlatformAccessToken(partnersToken)
      return accessToken
    }

    // Env token doesn't support admin or storefront-renderer
    return null
  }
}
```

#### `ThemeAccessProvider`

Extracts the password-handling conditionals from `ensureAuthenticatedThemes` and `ensureAuthenticatedStorefront`.

```typescript
class ThemeAccessProvider implements CredentialProvider {
  readonly name = 'ThemeAccess'

  constructor(private password: string) {}

  async getToken(audience: ApiAudience): Promise<string | null> {
    // Theme access tokens only work for admin and storefront-renderer
    if (audience === 'admin' || audience === 'storefront-renderer') {
      return this.password
    }
    return null
  }
}
```

#### `OAuthSessionProvider`

Wraps the `SessionCoordinator` (Component 2). This is the heavyweight provider that handles the full OAuth lifecycle.

```typescript
class OAuthSessionProvider implements CredentialProvider {
  readonly name = 'OAuthSession'

  constructor(private coordinator: SessionCoordinator) {}

  async getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null> {
    const tokenFamily = await this.coordinator.ensureValidSession({
      audiences: [audience],
      storeFqdn: context?.storeFqdn,
      forceRefresh: context?.forceRefresh,
      extraScopes: context?.extraScopes,
      noPrompt: context?.noPrompt,
    })

    if (!tokenFamily) return null
    return tokenFamily.getApplicationToken(audience, context?.storeFqdn) ?? null
  }
}
```

---

## Component 2: SessionCoordinator

The extracted, formalized version of what `ensureAuthenticated()` does today. Owns:

1. **Loading** cached sessions from disk
2. **Validating** against required scopes and expiry
3. **Refreshing** identity token + re-exchanging all application tokens
4. **Falling back** to device auth when refresh fails
5. **Persisting** updated sessions to disk
6. **Deduplicating** concurrent refresh attempts

### Interface

```typescript
// packages/cli-kit/src/public/node/api/auth/session-coordinator.ts

interface SessionCoordinator {
  /** Get a valid token family, refreshing or re-authenticating as needed. */
  ensureValidSession(requirements: SessionRequirements): Promise<TokenFamily | null>

  /** Force clear all sessions (logout). */
  clearSessions(): Promise<void>
}

interface SessionRequirements {
  audiences: ApiAudience[]
  storeFqdn?: string
  extraScopes?: string[]
  forceRefresh?: boolean
  noPrompt?: boolean
}
```

### TokenFamily

Immutable snapshot of the full token set. Replaces the current `Session` type.

```typescript
class TokenFamily {
  constructor(
    readonly identity: IdentityToken,
    readonly applications: ReadonlyMap<string, ApplicationToken>,
    readonly generation: number,
  ) {}

  getApplicationToken(audience: ApiAudience, storeFqdn?: string): string | undefined {
    const appId = applicationId(audience)
    const key = audience === 'admin' && storeFqdn ? `${storeFqdn}-${appId}` : appId
    return this.applications.get(key)?.accessToken
  }

  isExpired(marginMs: number = 5 * 60 * 1000): boolean {
    const threshold = new Date(Date.now() + marginMs)
    if (this.identity.expiresAt < threshold) return true
    for (const token of this.applications.values()) {
      if (token.expiresAt < threshold) return true
    }
    return false
  }
}

interface IdentityToken {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: Date
  readonly scopes: string[]
  readonly userId: string
}

interface ApplicationToken {
  readonly accessToken: string
  readonly expiresAt: Date
  readonly scopes: string[]
}
```

### State Machine

```
                  ┌─────────────┐
                  │  No Session  │
                  └──────┬──────┘
                         │ loadFromDisk()
                         ▼
                  ┌─────────────┐     scopes mismatch
          ┌──────│  Validate    │─────────────────────┐
          │      └──────┬──────┘                      │
          │ ok          │ expired                     │
          │             ▼                             ▼
          │      ┌─────────────┐              ┌─────────────┐
          │      │  Refreshing  │──── fail ──▶│  Device Auth │
          │      └──────┬──────┘     (grant)  └──────┬──────┘
          │             │ success                    │ success
          │             ▼                            ▼
          │      ┌─────────────┐              ┌─────────────┐
          └─────▶│  Valid       │◀─────────────│  Exchanging  │
                 └──────┬──────┘               └─────────────┘
                        │
                        ▼
                   persistToDisk()
```

### Refresh Deduplication

The singleton promise pattern. If multiple callers detect expired tokens simultaneously, only one refresh executes.

```typescript
class RefreshCoordinator {
  private inflight: Promise<TokenFamily> | null = null

  async refresh(current: TokenFamily, identityClient: IdentityClient): Promise<TokenFamily> {
    if (this.inflight) return this.inflight

    this.inflight = this.doRefresh(current, identityClient).finally(() => {
      this.inflight = null
    })

    return this.inflight
  }

  private async doRefresh(current: TokenFamily, identityClient: IdentityClient): Promise<TokenFamily> {
    const newIdentity = await identityClient.refreshIdentityToken(current.identity.refreshToken)
    const newApplications = await identityClient.exchangeAllTokens(newIdentity, {
      scopes: extractScopesFromFamily(current),
      storeFqdn: extractStoreFqdnFromFamily(current),
    })

    return new TokenFamily(
      newIdentity,
      new Map(Object.entries(newApplications)),
      current.generation + 1,
    )
  }
}
```

**Why this works in Node.js:** The check `if (this.inflight)` and the assignment `this.inflight = ...` run synchronously. Ten concurrent calls all share one promise. `.finally()` clears it when settled so the next caller starts fresh.

---

## Component 3: IdentityClient

HTTP-level client for `accounts.shopify.com`. **Uses `shopifyFetch()` directly** -- no middleware pipeline required. This is a refactor of the existing functions in `exchange.ts` and `device-authorization.ts` into a cohesive interface.

```typescript
// packages/cli-kit/src/public/node/api/auth/identity-client.ts

interface IdentityClient {
  initiateDeviceAuth(scopes: string[]): Promise<DeviceAuthorizationResponse>
  pollForDeviceApproval(deviceCode: string, intervalMs?: number): Promise<IdentityToken>
  exchangeToken(identityToken: string, target: ExchangeTarget): Promise<ApplicationToken>
  exchangeAllTokens(identity: IdentityToken, opts: ExchangeAllOpts): Promise<Record<string, ApplicationToken>>
  refreshIdentityToken(refreshToken: string): Promise<IdentityToken>
  exchangeCustomToken(token: string, target: ApiAudience): Promise<{ accessToken: string; userId: string }>
}

function createIdentityClient(): IdentityClient {
  // Implementation wraps existing functions:
  // - initiateDeviceAuth → requestDeviceAuthorization() from device-authorization.ts
  // - pollForDeviceApproval → pollForDeviceAuthorization() from device-authorization.ts
  // - exchangeToken → requestAppToken() from exchange.ts
  // - exchangeAllTokens → exchangeAccessForApplicationTokens() from exchange.ts
  // - refreshIdentityToken → refreshAccessToken() from exchange.ts
  // - exchangeCustomToken → exchangeCustomPartnerToken() from exchange.ts
  //
  // All use shopifyFetch() internally, unchanged from today.
}
```

The `SessionCoordinator` calls these methods. Consumers never call `IdentityClient` directly.

**Future pipeline integration:** When the north star pipeline ships, the `IdentityClient` implementation can be upgraded to use the pipeline (gaining retry middleware, observability, etc.) without changing its interface or any consumer code.

---

## How Existing Code Migrates

### Public API -- signatures unchanged

The existing `ensureAuthenticated*()` functions keep their exact signatures. They become thin wrappers:

```typescript
// Before (current -- duplicated env token checks, inline state machine):
export async function ensureAuthenticatedPartners(scopes, env, options) {
  const partnersToken = getPartnersToken()
  if (partnersToken) {
    const { accessToken, userId } = await exchangeCustomPartnerToken(partnersToken)
    return { token: accessToken, userId }
  }
  const oauthSession = await ensureAuthenticated({ partnersApi: { scopes } }, env, options)
  return { token: oauthSession.partners!, userId: oauthSession.userId }
}

// After (delegates to credential provider):
export async function ensureAuthenticatedPartners(scopes, env, options) {
  const provider = getDefaultCredentialProvider()
  const token = await provider.getToken('partners', {
    extraScopes: scopes,
    forceRefresh: options?.forceRefresh,
    noPrompt: options?.noPrompt,
  })
  if (!token) throw new AbortError('Could not authenticate with Partners API')
  const userId = await getLastSeenUserIdAfterAuth()
  return { token, userId }
}
```

### Service clients -- unchanged

`AppManagementClient`, `PartnersClient`, and theme commands continue to call `ensureAuthenticatedPartners()`, `ensureAuthenticatedAppManagementAndBusinessPlatform()`, etc. They receive tokens as strings, same as today.

The `unsafeRefreshToken()` method on `DeveloperPlatformClient` continues to work -- it calls `ensureAuthenticated*({ forceRefresh: true })`, which flows through the credential provider chain to the `SessionCoordinator`, which uses the `RefreshCoordinator` for deduplication.

### `createUnauthorizedHandler` -- simplified

The current `WeakMap<DeveloperPlatformClient, Promise<string>>` deduplication moves into `RefreshCoordinator`. The handler becomes:

```typescript
export function createUnauthorizedHandler(client: DeveloperPlatformClient, tokenType = 'default') {
  return {
    type: 'token_refresh',
    handler: async () => {
      // unsafeRefreshToken() now internally deduplicates via RefreshCoordinator
      await client.unsafeRefreshToken()
      const session = await client.session()
      return { token: tokenType === 'businessPlatform' ? session.businessPlatformToken : session.token }
    },
  }
}
```

The `WeakMap` and its manual dedup logic are deleted.

---

## Test Support

### `StaticCredentialProvider` -- replaces `vi.mock` for auth

```typescript
// packages/cli-kit/src/testing/api/credentials.ts

const defaultTestTokens: Record<ApiAudience, string> = {
  admin: 'test-admin-token',
  partners: 'test-partners-token',
  'storefront-renderer': 'test-storefront-token',
  'business-platform': 'test-bp-token',
  'app-management': 'test-appmgmt-token',
}

let overrides: Partial<Record<ApiAudience, string | undefined>> = {}

/** Override tokens for the current test. */
export function configureTestTokens(tokens: Partial<Record<ApiAudience, string | undefined>>): void {
  overrides = tokens
}

/** Reset to defaults. Call in afterEach. */
export function resetTestTokens(): void {
  overrides = {}
}

export function testCredentialProvider(): CredentialProvider {
  return {
    name: 'TestStatic',
    async getToken(audience) {
      if (audience in overrides) return overrides[audience] ?? null
      return defaultTestTokens[audience] ?? `test-${audience}-token`
    },
  }
}
```

Tests that currently do `vi.mock('@shopify/cli-kit/node/session')` can instead configure a static provider. The migration is gradual -- old tests keep working, new tests use the provider.

---

## Directory Structure

```
packages/cli-kit/src/
  public/node/api/
    auth/
      credential-provider.ts       CredentialProvider, chainProviders(), ApiAudience, TokenContext
      session-coordinator.ts       SessionCoordinator, TokenFamily, RefreshCoordinator
      identity-client.ts           IdentityClient interface + createIdentityClient()
      providers/
        env-token.ts               EnvTokenProvider (SHOPIFY_CLI_PARTNERS_TOKEN)
        theme-access.ts            ThemeAccessProvider (shptka_* passwords)
        identity-env.ts            IdentityEnvProvider (SHOPIFY_CLI_IDENTITY_TOKEN)
        oauth-session.ts           OAuthSessionProvider (disk-cached sessions)
      session-store.ts             Disk persistence (extracted from private/node/session/store.ts)

  public/node/session.ts           Existing public API -- signatures unchanged, internals rewired

  testing/api/
    credentials.ts                 testCredentialProvider, configureTestTokens, resetTestTokens
```

### What Replaces What

| Current code | New code |
|---|---|
| `private/node/session.ts` → `ensureAuthenticated()` | `SessionCoordinator.ensureValidSession()` |
| `private/node/session/exchange.ts` → all exchange functions | `IdentityClient` methods (wrapping existing functions initially) |
| `private/node/session/device-authorization.ts` | `IdentityClient.initiateDeviceAuth()` + `pollForDeviceApproval()` |
| `private/node/session/validate.ts` → `validateSession()` | `SessionCoordinator` internal validation |
| `private/node/session/store.ts` | `SessionStore` (extracted, injectable) |
| `private/node/session/schema.ts` → `Session`, `Sessions` | `TokenFamily`, `IdentityToken`, `ApplicationToken` |
| `public/node/session.ts` → `ensureAuthenticatedPartners()`, etc. | Same signatures, internals call `credentialProvider.getToken()` |
| WeakMap in `developer-platform-client.ts` | `RefreshCoordinator` (singleton promise) |

---

## Token Type Coverage

| Token type | Provider | Refresh mechanism | Notes |
|---|---|---|---|
| Identity (device auth) | `OAuthSessionProvider` | `RefreshCoordinator` → `identityClient.refreshIdentityToken()` | Root token for all app tokens |
| Partners app token | `OAuthSessionProvider` or `EnvTokenProvider` | Re-exchange from identity refresh | Batch with other app tokens |
| Admin app token | `OAuthSessionProvider` | Re-exchange from identity refresh | Store-scoped: key includes `storeFqdn` |
| Storefront Renderer token | `OAuthSessionProvider` | Re-exchange from identity refresh | Batch with other app tokens |
| Business Platform token | `OAuthSessionProvider` or `EnvTokenProvider` | Re-exchange from identity refresh | Batch with other app tokens |
| App Management token | `OAuthSessionProvider` or `EnvTokenProvider` | Re-exchange from identity refresh | Batch with other app tokens |
| Theme Access (`shptka_*`) | `ThemeAccessProvider` | None (static until revoked) | Password from CLI arg or env |
| Custom CLI token | `EnvTokenProvider` | None (user-managed) | `SHOPIFY_CLI_PARTNERS_TOKEN` env var |
| App Logs JWT | Not in credential chain | `PollingClient.onResubscribe` → `AppLogsSubscribe` mutation | Short-lived, request-scoped |

---

## What This Delivers (Independent of Pipeline)

1. **Single credential resolution path.** Every `ensureAuthenticated*()` function flows through the same chain. No more duplicated env-var checks.

2. **Concurrent refresh deduplication.** The `RefreshCoordinator` ensures one refresh per token family, regardless of how many callers trigger it.

3. **Testable auth seam.** `configureTestTokens({ admin: 'fake' })` replaces module-level `vi.mock` for auth in new tests.

4. **Formalized state machine.** `SessionCoordinator` makes the validate → refresh → re-auth → persist flow explicit, testable, and extensible.

5. **Deleted WeakMap.** The manual deduplication in `createUnauthorizedHandler` is replaced by `RefreshCoordinator`.

6. **Stable interface for the pipeline.** When the north star pipeline ships, its auth middleware calls `credentialProvider.getToken(audience)` -- the same interface, already tested and proven.

---

## What This Does NOT Change

- Public signatures of `ensureAuthenticatedPartners()`, `ensureAuthenticatedThemes()`, etc.
- How `partnersRequestDoc()`, `adminRequestDoc()`, etc. receive and use tokens
- The Bottleneck rate limiting, retry logic, or `graphqlRequestDoc()` infrastructure
- The `DeveloperPlatformClient` interface or its implementations
- Any consumer code in `packages/app/` or `packages/theme/`
- The session storage format on disk (backward compatible)
