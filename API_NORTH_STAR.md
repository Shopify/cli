# API Client North Star Architecture

> **Date:** 2026-02-09
> **Context:** [API_AUDIT.md](./API_AUDIT.md) (current state), [API_UNIFICATION_PROPOSAL.md](./API_UNIFICATION_PROPOSAL.md) (problems and criteria)
> **Purpose:** Define the target architecture, directory structure, interfaces, and layering for a unified API client

---

## Architecture Overview

Four layers. Each has a single responsibility. Each is independently testable. Each has a clear directory location.

```
Layer 4: Service Clients        Where to send it, what API-specific setup is needed
Layer 3: Protocol Adapters      How to serialize/deserialize (GraphQL vs REST)
Layer 2: HTTP Pipeline           Cross-cutting behavior (retry, auth, rate-limit, timeout, observability)
Layer 1: Transport              Actually sending bytes over the wire
```

The boundary rule: **each layer depends only on the layer directly below it.** Service clients do not touch the transport -- they declare a `mode` and the infrastructure resolves the right transport. Middleware does not parse GraphQL responses. The transport does not know about tokens.

---

## Layer 1: Transport

The only layer that touches the network. Everything above it works with `HttpRequest` / `HttpResponse` values.

### Interface

```typescript
// packages/cli-kit/src/public/node/api/transport.ts

interface Transport {
  send(request: HttpRequest): Promise<HttpResponse>
}

interface HttpRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers: Record<string, string>
  body?: string | Buffer
  signal?: AbortSignal
}

interface HttpResponse {
  status: number
  headers: Record<string, string>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}
```

### Implementations

- **`nodeTransport`**: Production implementation wrapping `node-fetch` with `httpsAgent()` for TLS. This is what `shopifyFetch()` does today, minus the retry/abort logic which moves to middleware.
- **`mockTransport`**: Test/dev implementation. Returns canned responses, records requests for assertions. See [Testing](#testing).

### Transport Resolution via Mode

Service clients do not receive a transport directly. Instead, they accept a `mode` that the infrastructure resolves to the appropriate transport, middleware configuration, and environment behavior:

```typescript
// packages/cli-kit/src/public/node/api/mode.ts

type ClientMode = 'production' | 'development' | 'test'

interface ResolvedMode {
  transport: Transport
  /** Whether retry/rate-limit middleware should be active. */
  enableResilience: boolean
  /** Whether to log request details. */
  enableObservability: boolean
}

function resolveMode(mode?: ClientMode): ResolvedMode {
  const effective = mode ?? inferMode()
  switch (effective) {
    case 'production':
      return { transport: nodeTransport, enableResilience: true, enableObservability: true }
    case 'development':
      return { transport: nodeTransport, enableResilience: true, enableObservability: true }
    case 'test':
      return { transport: globalMockTransport(), enableResilience: false, enableObservability: false }
  }
}

function inferMode(): ClientMode {
  if (process.env.SHOPIFY_UNIT_TEST) return 'test'
  if (process.env.SHOPIFY_CLI_ENV === 'development') return 'development'
  return 'production'
}
```

The `test` mode automatically wires up a mock transport and disables retry/rate-limiting so tests run fast and deterministically. The `development` mode uses the real network but could configure looser timeouts or additional debug logging in the future. The `production` mode is the default.

For advanced testing scenarios that need fine-grained transport control (e.g., testing retry behavior against a sequence of responses), the mock transport is accessible via the testing utilities:

```typescript
import { configureMockTransport } from '@shopify/cli-kit/testing/api/transport'

// In test setup:
const mock = configureMockTransport()
mock.onGraphQL(GetTheme).respondWith({ theme: { id: '1', name: 'Dawn' } })

// The test-mode client automatically uses this mock.
const client = await createPartnersClient({ token, mode: 'test' })
```

This keeps the primary API simple (`mode: 'test'`) while preserving escape hatches for sophisticated test scenarios.

### What does NOT go through Transport

- **WebSocket** connections (UI extensions dev console) - long-lived, bidirectional
- **SSE** streams (theme hot-reload server) - server-push, indefinite
- **App logs polling** - state machine with cursor tracking and variable intervals

These use the Transport's TLS configuration and URL resolution but bypass the middleware pipeline. They are separate client types, not special cases of request/response. See [Non-Pipeline Clients](#non-pipeline-clients).

---

## Layer 2: HTTP Pipeline

Composable middleware stack using the onion model. Each middleware sees the outbound request and inbound response.

### Interface

```typescript
// packages/cli-kit/src/public/node/api/pipeline.ts

type Middleware = (
  request: HttpRequest,
  next: Handler,
  context: PipelineContext,
) => Promise<HttpResponse>

type Handler = (request: HttpRequest) => Promise<HttpResponse>

interface PipelineContext {
  /** Which API surface (for logging/metrics). Set by the service client. */
  api: string
  /** Current retry attempt (0-indexed). Set by retry middleware. */
  attempt: number
  /** Pipeline start time. */
  startTime: number
  /** Request ID from response headers. Set by observability middleware. */
  requestId?: string
  /** Per-request overrides. Service clients and callers can set these. */
  overrides: {
    retry?: Partial<RetryPolicy>
    timeout?: { disabled?: boolean; timeoutMs?: number }
  }
  /** Extensible slot for middleware to communicate across invocations. */
  [key: symbol]: unknown
}

function composePipeline(
  middlewares: readonly Middleware[],
  transport: Transport,
): Handler
```

### Middleware Ordering

The order in the array determines composition semantics. First middleware is outermost (runs first on request, last on response).

```typescript
const pipeline = composePipeline([
  observabilityMiddleware({ api: 'Partners' }),    // 1. Outermost: logs total duration including retries
  rateLimitMiddleware({ minTimeMs: 150, max: 10 }),// 2. Queues before entering retry
  retryMiddleware({ policy, errorClassifier }),     // 3. Retries the inner pipeline
  authMiddleware({ tokenManager }),                 // 4. Injects auth header, refreshes on 401
  timeoutMiddleware({ timeoutMs: 30_000 }),         // 5. Innermost: per-attempt timeout
], transport)
```

**Why this order:**
- Observability outside retry: captures total duration, not per-attempt
- Rate limit outside retry: prevents retry storms from exceeding API limits
- Auth inside retry: refreshed token is used on retry
- Timeout inside auth: each attempt (including post-refresh retry) gets a fresh timeout

### Middleware Catalog

#### `retryMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/retry.ts

interface RetryPolicy {
  maxRetries: number           // default: 10
  initialDelayMs: number       // default: 1000
  maxDelayMs: number           // default: 10000
  retryableStatuses: Set<number> // default: {429, 503}
}

// Error classifier: service clients control what gets retried
type ErrorClassifier = (status: number) => 'retry' | 'no-retry'
```

Honors `retry-after` header. Exponential backoff with jitter. Surfaces retry metadata to context for observability.

#### `rateLimitMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/rate-limit.ts

interface RateLimitConfig {
  minTimeMs: number       // default: 150 (matches current Bottleneck config)
  maxConcurrent: number   // default: 10
}
```

Wraps Bottleneck. Replaces the 5 identical Bottleneck instances currently scattered across service modules. Also accepts a `postResponseDelay` signal from the GraphQL adapter for rate-limit restore (see [Rate-Limit Restore](#rate-limit-restore)).

#### `authMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/auth.ts

interface TokenManager {
  getToken(): Promise<string>
  refreshToken(): Promise<string>  // internally deduplicates concurrent calls
}
```

Injects `Authorization: Bearer {token}`. On 401 response, calls `tokenManager.refreshToken()` and retries once. The `TokenManager` is shared across all pipelines for the same logical client identity, providing deduplication without a module-level WeakMap.

#### `timeoutMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/timeout.ts

interface TimeoutConfig {
  timeoutMs: number  // default: 30_000
}
```

Creates an `AbortController` per attempt. Respects `context.overrides.timeout.disabled` for long-running operations (theme uploads). Composes with caller-provided signals.

#### `observabilityMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/observability.ts

interface ObservabilityConfig {
  api: string
  reporter?: TelemetryReporter  // default: monorailReporter
}
```

Captures: URL (sanitized), method, status, duration, request ID, retry count. Writes to `outputDebug()`, `requestIdsCollection`, and the configured reporter. The reporter interface decouples from Monorail/OTEL specifics.

#### `deprecationMiddleware`

```typescript
// packages/cli-kit/src/public/node/api/middleware/deprecation.ts
```

Extracts `extensions.deprecations[].supportedUntilDate` from response body. Replaces the duplicated `handleDeprecations()` in Partners and App Management. Configured per-pipeline -- only attached to services that return deprecation extensions.

---

## Layer 3: Protocol Adapters

Serializes requests into the wire format and deserializes responses into typed data. Knows about GraphQL or REST structure. Does NOT know about retry, auth, or rate limiting.

### GraphQL Adapter

```typescript
// packages/cli-kit/src/public/node/api/graphql-adapter.ts

interface GraphQLClient {
  request<TResult, TVariables extends Variables>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables?: TVariables,
    options?: GraphQLRequestOptions,
  ): Promise<TResult>

  /** @deprecated Migration path for inline gql strings. Remove with Partners client. */
  requestUntyped<TResult>(
    query: string,
    variables?: Record<string, unknown>,
    options?: GraphQLRequestOptions,
  ): Promise<TResult>
}

interface GraphQLRequestOptions {
  /** Additional headers for this specific request. */
  headers?: Record<string, string>
  /** Per-request pipeline overrides (retry policy, timeout, etc). */
  context?: Partial<PipelineContext['overrides']>
}

function createGraphQLClient(options: {
  pipeline: Handler
  baseUrl: string | ((context: Record<string, string>) => Promise<string>)
  cacheOptions?: CacheConfig
}): GraphQLClient
```

**Responsibilities:**
- Serializes `TypedDocumentNode` + variables into JSON body
- Sends `POST` through the pipeline
- Deserializes response, extracts `data` and `errors`
- Throws `GraphQLClientError` (structured, with `errors` array and status)
- Manages response caching (see below)
- Emits rate-limit restore signal to the pipeline's rate-limit middleware

#### Caching

Caching lives in the adapter, before the pipeline. On cache hit, the request never enters the middleware stack (no rate-limit cost, no observability noise beyond a debug log). On cache miss, the response is cached after the full pipeline round-trip.

```typescript
interface CacheConfig {
  cacheTTL: TimeInterval
  cacheExtraKey?: string
  cacheStore?: LocalStorage
}

// Cache key: q-{queryHash}-{variablesHash}-{CLI_KIT_VERSION}-{extraKey}
// Matches the current format exactly for backward compatibility.
```

#### Rate-Limit Restore

After receiving a GraphQL response, the adapter reads `extensions.cost.throttleStatus.restoreRate` and signals the rate-limit middleware via a shared `RateLimitSignal`:

```typescript
interface RateLimitSignal {
  delayBeforeNextRequestMs: number
}
```

The adapter parses the GraphQL extensions (it already understands the response shape). The rate-limit middleware consumes the signal to throttle subsequent requests. This avoids middleware parsing GraphQL bodies.

### REST Adapter

```typescript
// packages/cli-kit/src/public/node/api/rest-adapter.ts

interface RestClient {
  request<TResult = unknown>(options: RestRequestOptions): Promise<RestResponse<TResult>>
}

interface RestRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
  searchParams?: Record<string, string>
  headers?: Record<string, string>
  context?: Partial<PipelineContext['overrides']>
}

interface RestResponse<T = unknown> {
  json: T
  status: number
  headers: Record<string, string[]>
}

function createRestClient(options: {
  pipeline: Handler
  baseUrl: string
  apiVersion?: string
}): RestClient
```

**Responsibilities:**
- Constructs URL from `baseUrl` + `apiVersion` + `path` + `.json`
- Serializes body to JSON
- Sends through the pipeline
- Returns `{json, status, headers}`

---

## Layer 4: Service Clients

Thin factories that wire up the correct URL, auth, middleware configuration, and protocol adapter for each Shopify API. This is the public API that consumers import.

### Factory Pattern

Each service client is an **async factory function** that returns a configured protocol adapter. Factories accept a `mode` rather than a raw transport:

```typescript
// packages/cli-kit/src/public/node/api/clients/partners.ts

async function createPartnersClient(options: {
  token: string
  refreshToken?: () => Promise<string>
  mode?: ClientMode  // 'production' | 'development' | 'test' (default: inferred from env)
}): Promise<GraphQLClient>
```

Factories are async because some need to resolve FQDNs or API versions before constructing the pipeline. The `mode` controls transport selection, resilience behavior, and observability -- consumers never need to think about transport wiring.

### Construction-Time Decisions

These are resolved once in the factory, not per-request:

| Decision | Where resolved | Current code |
|----------|---------------|--------------|
| Service FQDN | `partnersFqdn()`, `appManagementFqdn()`, etc. | `fqdn.ts` |
| Admin API version | `fetchLatestSupportedApiVersion()` | `admin.ts:78-80` |
| Theme Access proxy routing | `session.token.startsWith('shptka_')` | `rest.ts:43` |
| Local dev environment routing | `serviceEnvironment() === 'local'` | `admin.ts:43`, `app-dev.ts:47` |
| Token type selection | Session structure | `identity.ts` |

### Service Client Catalog

Each factory returns a **single protocol type**. GraphQL and REST are separate clients, even for the same API surface (e.g., Admin). This keeps each client focused and avoids mixing protocol concerns.

```typescript
// --- Authentication ---

// Identity/OAuth (REST -- device auth, token exchange, token refresh)
createIdentityClient({ clientId, mode? }): Promise<IdentityClient>

// --- Shopify GraphQL APIs ---

// Partners API
createPartnersClient({ token, refreshToken?, mode? }): Promise<GraphQLClient>

// Admin API -- separate clients per protocol
createAdminGraphQLClient({ session, mode? }): Promise<GraphQLClient>
createAdminRestClient({ session, mode? }): Promise<RestClient>

// App Management API
createAppManagementClient({ token, refreshToken?, mode? }): Promise<GraphQLClient>

// App Dev API
createAppDevClient({ shopFqdn, token, refreshToken?, mode? }): Promise<GraphQLClient>

// Business Platform (returns sub-clients for two endpoints)
createBusinessPlatformClient({ token, refreshToken?, mode? }): Promise<{
  destinations: GraphQLClient
  organizations: (orgId: string) => GraphQLClient
}>

// Functions API
createFunctionsClient({ orgId, appId, token, refreshToken?, mode? }): Promise<GraphQLClient>

// Webhooks API
createWebhooksClient({ orgId, token, refreshToken?, mode? }): Promise<GraphQLClient>

// --- Theme Development ---

// Storefront Rendering (REST -- HTML rendering for theme dev)
createStorefrontRenderingClient({ session, mode? }): Promise<RestClient>
```

**Why split REST and GraphQL for Admin?** The Admin API is the only Shopify API that uses both protocols. Bundling them in one factory forces consumers who only need GraphQL to also pull in REST types, and vice versa. Separate factories also make the dependency graph clearer in tests -- a function that imports `createAdminGraphQLClient` obviously makes GraphQL calls; one that imports `createAdminRestClient` makes REST calls. The two factories share the same construction-time decisions (session, API version, proxy routing) via a shared internal helper.

### Admin Clients: The Complex Case

The Admin API is the most complex because it:
1. Resolves API version via a bootstrap API call
2. Routes through Theme Access proxy based on token format
3. Routes through DevServer in local environment
4. Serves both GraphQL and REST (as separate clients)
5. Has domain-specific error mapping (403 → "no access to dev store")

Both `createAdminGraphQLClient` and `createAdminRestClient` delegate to a shared internal setup:

```typescript
// Shared setup -- not exported. Resolves all construction-time decisions once.
async function resolveAdminConfig(options: {
  session: AdminSession
  mode?: ClientMode
}): Promise<AdminConfig> {
  const { session, mode } = options
  const { transport, enableResilience } = resolveMode(mode)
  const isThemeAccess = session.token.startsWith('shptka_')
  const isLocal = serviceEnvironment() === 'local'

  // 1. Resolve base domain
  let domain = session.storeFqdn
  const extraHeaders: Record<string, string> = {}
  if (isThemeAccess) {
    domain = themeKitAccessDomain
    extraHeaders['X-Shopify-Shop'] = session.storeFqdn
  }
  if (isLocal) {
    extraHeaders['x-forwarded-host'] = session.storeFqdn
    domain = new DevServerCore().host('app')
  }

  // 2. Bootstrap API version (itself a pipeline call)
  const apiVersion = await resolveApiVersion(session, mode)

  // 3. Build base URL
  const prefix = isThemeAccess ? `https://${domain}/cli` : `https://${domain}`

  // 4. Build shared pipeline
  const tokenManager = createTokenManager(session)
  const middlewares = [
    observabilityMiddleware({ api: 'Admin' }),
    ...(enableResilience ? [
      retryMiddleware({ errorClassifier: adminErrorClassifier }),
    ] : []),
    authMiddleware({ tokenManager, extraHeaders }),
    ...(enableResilience ? [
      timeoutMiddleware({ timeoutMs: 30_000 }),
    ] : []),
  ]

  return { prefix, apiVersion, middlewares, transport }
}

// Public factories -- one per protocol
async function createAdminGraphQLClient(options: {
  session: AdminSession
  mode?: ClientMode
}): Promise<GraphQLClient> {
  const { prefix, apiVersion, middlewares, transport } = await resolveAdminConfig(options)
  const pipeline = composePipeline(middlewares, transport)
  return createGraphQLClient({
    pipeline,
    baseUrl: `${prefix}/admin/api/${apiVersion}/graphql.json`,
  })
}

async function createAdminRestClient(options: {
  session: AdminSession
  mode?: ClientMode
}): Promise<RestClient> {
  const { prefix, apiVersion, middlewares, transport } = await resolveAdminConfig(options)
  const pipeline = composePipeline(middlewares, transport)
  return createRestClient({
    pipeline,
    baseUrl: `${prefix}/admin/api/${apiVersion}`,
    apiVersion,
  })
}
```

Error mapping (403/401/404 → `AbortError`) lives in wrappers around the factories, not inside them:

```typescript
async function createAdminGraphQLClientWithErrorHandling(session: AdminSession, mode?: ClientMode) {
  try {
    return await createAdminGraphQLClient({ session, mode })
  } catch (error) {
    throw mapAdminBootstrapError(error, session)
  }
}
```

### Authentication Client: Identity/OAuth

The authentication client is the foundation all other clients depend on. It wraps the `accounts.shopify.com` OAuth endpoints (device authorization, token exchange, token refresh) that currently live scattered across `cli-kit/src/private/node/session/`.

```typescript
// packages/cli-kit/src/public/node/api/clients/identity.ts

interface IdentityClient {
  /** Initiate device authorization flow. Returns code for user to enter at verification URL. */
  initiateDeviceAuth(scopes: string[]): Promise<DeviceAuthorizationResponse>

  /** Poll until user approves. Returns identity token. Handles slow_down/expired_token. */
  pollForDeviceApproval(deviceCode: string, intervalMs?: number): Promise<IdentityToken>

  /** Exchange identity token for an API-specific application token. */
  exchangeToken(identityToken: string, target: {
    api: ApiName
    scopes: string[]
    store?: StoreFqdn  // required for Admin API
  }): Promise<ApplicationToken>

  /** Refresh an expired identity token. */
  refreshIdentityToken(refreshToken: string): Promise<IdentityToken>

  /** Exchange a custom CLI token (SHOPIFY_CLI_PARTNERS_TOKEN) for API access. */
  exchangeCustomToken(token: string, target: ApiName): Promise<ApplicationToken>
}

interface DeviceAuthorizationResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresIn: number
  interval: number
}

interface IdentityToken {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  userId: string
}

interface ApplicationToken {
  accessToken: string
  expiresAt: Date
}

type ApiName = 'admin' | 'partners' | 'storefront-renderer' | 'business-platform' | 'app-management'

async function createIdentityClient(options: {
  clientId?: string  // defaults to production client ID
  mode?: ClientMode
}): Promise<IdentityClient>
```

**Why this matters:** The current code in `session/exchange.ts` and `session/device-authorization.ts` uses raw `shopifyFetch` with hand-built form-encoded bodies and manual error parsing. Wrapping it in a client that goes through the pipeline gives it retry on transient errors, observability (how long do token exchanges take?), and testability (mock the auth flow without module-patching `exchangeAccessForApplicationTokens`).

**Relationship to `TokenManager`:** The `IdentityClient` is the *implementation* behind `TokenManager.refreshToken()`. When a service client's auth middleware detects a 401, it calls `tokenManager.refreshToken()`, which delegates to `authClient.refreshIdentityToken()` + `authClient.exchangeToken()`.

### Storefront Rendering Client

The theme dev server proxies requests to Shopify's storefront rendering infrastructure. This is currently raw `fetch()` calls in `theme/src/cli/utilities/theme-environment/storefront-renderer.ts` with inline header construction and URL building.

```typescript
// packages/cli-kit/src/public/node/api/clients/storefront-rendering.ts

async function createStorefrontRenderingClient(options: {
  session: DevServerSession  // AdminSession or Theme Access session
  themeId: string
  mode?: ClientMode
}): Promise<RestClient>
```

**Construction-time decisions:**
- If `session.token.startsWith('shptka_')`: routes through Theme Kit Access proxy (`https://{themeKitAccessDomain}/cli/sfr`)
- Otherwise: routes directly to `https://{storeFqdn}/...`
- Session cookies and storefront tokens are injected as headers
- Local dev routing applies the same `DevServerCore` pattern as Admin

**Why a client and not inline `fetch`:** Storefront rendering calls need retry (the storefront can 429), observability (rendering latency is a key UX metric for `theme dev`), and testability (theme dev tests currently cannot mock rendering without `vi.mock`). The `RestClient` interface is sufficient -- no special protocol adapter needed.

---

## Non-Pipeline Clients

Three patterns do not fit the request/response pipeline:

### PollingClient (App Logs)

Individual poll requests go through a normal pipeline. The polling loop, cursor tracking, JWT refresh, and variable intervals live outside:

```typescript
// packages/cli-kit/src/public/node/api/polling.ts

interface PollingClient<T> {
  start(options: PollingOptions): AsyncIterable<T>
  stop(): void
}

interface PollingOptions {
  intervalMs: number           // 450ms for app logs
  errorRetryMs: number         // 5000ms
  throttleRetryMs: number      // 60000ms
  onResubscribe: () => Promise<string>  // JWT refresh
}
```

Each poll is a normal `pipeline(request)` call. The state machine (which interval to use, when to resubscribe) lives in the `PollingClient`.

### ConnectionClient (WebSocket)

For the UI extensions dev console. Uses the Transport's TLS config and URL resolution but has its own lifecycle:

```typescript
interface ConnectionClient {
  connect(url: string): void
  onMessage(handler: (data: unknown) => void): void
  onClose(handler: () => void): void
  send(data: unknown): void
  close(): void
}
```

Auth is injected at connection establishment time (URL query params or initial handshake), not per-message.

### SSE Server (Theme Hot-Reload)

The CLI is the _server_ here, pushing events to the browser. This is not an outbound API call at all. It remains outside the API client architecture entirely.

---

## Shared Types

```typescript
// packages/cli-kit/src/public/node/api/types.ts

/** Structured error for all pipeline failures. Preserves status and retry metadata. */
class PipelineError extends Error {
  constructor(
    readonly kind: 'graphql_errors' | 'http_error' | 'network_error' | 'timeout' | 'rate_limited' | 'unauthorized',
    readonly statusCode: number | undefined,
    readonly requestId: string | undefined,
    readonly retriesAttempted: number,
    readonly retryable: boolean,
    readonly graphqlErrors?: ReadonlyArray<{ message: string; extensions?: Record<string, unknown> }>,
    readonly retryAfterMs?: number,
  ) { super(...) }
}

/** Branded types for compile-time safety. Zero runtime overhead. */
type ApiToken = string & { readonly __brand: 'ApiToken' }
type StoreFqdn = string & { readonly __brand: 'StoreFqdn' }
type OrganizationId = string & { readonly __brand: 'OrganizationId' }

/** Token lifecycle management. See API_SESSION_DESIGN.md for full design. */
interface CredentialProvider {
  readonly name: string
  getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null>
}

type ApiAudience = 'admin' | 'partners' | 'storefront-renderer' | 'business-platform' | 'app-management'
```

---

## Directory Structure

```
packages/cli-kit/src/
  public/node/api/
    # Layer 1: Transport
    transport.ts                    Transport interface, nodeTransport, HttpRequest, HttpResponse

    # Layer 2: Pipeline
    pipeline.ts                     Middleware type, PipelineContext, composePipeline()
    middleware/
      retry.ts                      RetryPolicy, ErrorClassifier, retryMiddleware
      rate-limit.ts                 RateLimitConfig, RateLimitSignal, rateLimitMiddleware
      auth.ts                       TokenManager, authMiddleware
      timeout.ts                    TimeoutConfig, timeoutMiddleware
      observability.ts              ObservabilityConfig, TelemetryReporter, observabilityMiddleware
      deprecation.ts                deprecationMiddleware

    # Layer 3: Protocol Adapters
    graphql-adapter.ts              GraphQLClient, createGraphQLClient, CacheConfig
    rest-adapter.ts                 RestClient, createRestClient

    # Layer 4: Service Clients
    clients/
      identity.ts                     createIdentityClient (Identity/OAuth)
      partners.ts                   createPartnersClient (GraphQL)
      admin-graphql.ts              createAdminGraphQLClient
      admin-rest.ts                 createAdminRestClient
      admin-shared.ts               resolveAdminConfig (shared construction logic, not exported)
      app-management.ts             createAppManagementClient (GraphQL)
      app-dev.ts                    createAppDevClient (GraphQL)
      business-platform.ts          createBusinessPlatformClient (destinations + organizations)
      webhooks.ts                   createWebhooksClient (GraphQL)
      functions.ts                  createFunctionsClient (GraphQL)
      storefront-rendering.ts       createStorefrontRenderingClient (REST)

    # Non-Pipeline Clients
    polling.ts                      PollingClient for app logs
    connection.ts                   ConnectionClient for WebSocket

    # Shared Types
    types.ts                        PipelineError, branded types, TokenManager

  # Testing Utilities
  testing/api/
    transport.ts                    createMockTransport, sequenceTransport
    fixtures.ts                     graphqlResponse, errorResponse, rateLimitedResponse
```

### Package Exports

All new code lives under `src/public/node/api/`, which maps to the existing `@shopify/cli-kit/*` export pattern via the wildcard in `package.json`:

```
@shopify/cli-kit/node/api/transport            → dist/public/node/api/transport.js
@shopify/cli-kit/node/api/pipeline             → dist/public/node/api/pipeline.js
@shopify/cli-kit/node/api/mode                 → dist/public/node/api/mode.js
@shopify/cli-kit/node/api/clients/admin-graphql → dist/public/node/api/clients/admin-graphql.js
@shopify/cli-kit/node/api/clients/admin-rest    → dist/public/node/api/clients/admin-rest.js
@shopify/cli-kit/testing/api/transport          → dist/testing/api/transport.js
```

No changes to `package.json` exports needed. No barrel files.

---

## Testing

### Mode-Based Testing

The primary testing mechanism is `mode: 'test'`, not manual transport injection. When a service client is created with `mode: 'test'`:
- The mock transport is wired automatically
- Retry and rate-limiting middleware are disabled (tests run fast)
- Observability is silent (no debug noise in test output)

```typescript
// Simple: create a client in test mode, configure mock responses
const mock = configureMockTransport()
mock.onGraphQL(GetBulkOperationById).respondWith({
  node: { id: 'gid://shopify/BulkOperation/1', status: 'COMPLETED', url: '...' }
})

const client = await createAdminGraphQLClient({ session, mode: 'test' })
const result = await client.request(GetBulkOperationById, { id: 'gid://...' })
```

### Three Levels of Mocking

| Level | What's mocked | Use case | Tool |
|-------|--------------|----------|------|
| Transport (via mode) | HTTP responses | Test service client logic, response transformation | `configureMockTransport()` + `mode: 'test'` |
| Transport (explicit) | HTTP responses with resilience | Test middleware behavior (retry, rate-limit, timeout) | `mode: 'test'` with `enableResilience: true` override |
| Service client | Business-level return values | Test commands and services | Interface mock (existing `testDeveloperPlatformClient` pattern) |

### Mock Transport API

```typescript
// packages/cli-kit/src/testing/api/transport.ts

/** Get the shared mock transport for the current test. Call in beforeEach or in the test body. */
function configureMockTransport(): MockTransport

interface MockTransport extends Transport {
  /** Register a response for a specific GraphQL operation. */
  onGraphQL<TResult>(document: TypedDocumentNode<TResult, any>): {
    respondWith(data: TResult, options?: { extensions?: Record<string, unknown> }): void
    respondWithError(status: number, errors?: Array<{ message: string }>): void
  }

  /** Register a response for a URL pattern (REST, CDN, etc). */
  onRequest(urlPattern: string | RegExp): {
    respondWith(status: number, body: unknown, headers?: Record<string, string>): void
  }

  /** Assert that a request was made. */
  assertCalledWith(urlPattern: string | RegExp): void

  /** Register a sequence of responses (for testing retry). */
  onGraphQL<TResult>(document: TypedDocumentNode<TResult, any>): {
    respondWithSequence(responses: Array<{ data?: TResult; status?: number; error?: string }>): void
  }

  /** Reset all registered responses. Call in afterEach. */
  reset(): void
}
```

### Usage Examples

```typescript
// Before (current pattern - module mocking):
vi.mock('@shopify/cli-kit/node/api/admin')
vi.mocked(adminRequestDoc).mockResolvedValue(mockResponse)

// After (mode-based):
const mock = configureMockTransport()
mock.onGraphQL(GetBulkOperationById).respondWith({
  node: { id: 'gid://shopify/BulkOperation/1', status: 'COMPLETED', url: '...' }
})
const client = await createAdminGraphQLClient({ session, mode: 'test' })
```

```typescript
// Testing retry behavior (opt into resilience in test mode):
const mock = configureMockTransport()
mock.onGraphQL(GetTheme).respondWithSequence([
  { status: 429 },                              // first call: rate limited
  { data: { theme: { id: '1', name: 'Dawn' } } } // second call: success
])
// Create client with resilience enabled to test retry
const client = await createAdminGraphQLClient({ session, mode: 'test' })
// The retry middleware will automatically retry after the 429
```

### Migration Path

Functions that make API calls will gradually adopt the new client pattern. During migration:
- **Existing code** continues using `adminRequestDoc()` + `vi.mock()` -- nothing breaks
- **New code** uses `createAdminGraphQLClient({ mode })` -- no `vi.mock` needed
- Functions are migrated one-by-one to accept an injected client parameter

---

## Design Decisions Log

Decisions made during battle-testing, with rationale:

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Caching in the adapter, not middleware** | Cache keys require GraphQL knowledge (query hash, variables hash). Cached responses should not count against rate limits. Cache hits emit lightweight observability events, not full request telemetry. |
| 2 | **Rate-limit restore via signal, not middleware parsing** | The adapter parses `extensions.cost.throttleStatus.restoreRate` (it already understands GraphQL). It emits a `RateLimitSignal` that the rate-limit middleware consumes for the next request. Avoids middleware parsing response bodies. |
| 3 | **Token refresh deduplication via `CredentialProvider` chain + `RefreshCoordinator`** | Replaces both the per-pipeline `TokenManager` and the module-level WeakMap. A `CredentialProvider` chain (env token → theme access → OAuth session) resolves tokens. The `OAuthSessionProvider` uses a `RefreshCoordinator` with singleton-promise deduplication. Multiple pipelines sharing the same provider chain automatically get deduplication. See [API_SESSION_DESIGN.md](./API_SESSION_DESIGN.md). |
| 4 | **Theme Access routing at construction time, not per-request** | Token prefix (`shptka_`) is known when the client is created and never changes. The factory produces structurally different pipelines based on session type. Same for local dev routing. |
| 5 | **Admin API version resolved in factory bootstrap** | `fetchLatestSupportedApiVersion()` is an async call that needs its own pipeline. The factory runs this during construction, caches the result, and bakes it into the URL. Domain-specific error mapping for the bootstrap call lives in a wrapper, not the factory. |
| 6 | **`requestUntyped()` as a deprecated migration path** | 26+ inline `gql` string operations in Partners cannot all be converted to `.graphql` files at once. The adapter accepts both typed documents and raw strings, with the raw path marked `@deprecated`. Tied to Partners client sunset timeline. |
| 7 | **Pipeline context supports per-request overrides** | Theme operations need 90s retry timeout with no abort signal. App logs polling needs custom intervals. Per-request `context.overrides` lets callers tune behavior without creating separate pipelines. |
| 8 | **Streaming/polling are separate client types** | WebSocket, SSE, and polling loops do not fit request/response middleware. They share TLS and URL infrastructure but have their own lifecycle management. Forcing them into the pipeline would create middleware that is only active for one client type. |
| 9 | **Error classifier is per-service** | Admin treats 403 as "no store access" (don't retry). Partners treats 403 differently. The retry middleware accepts an `ErrorClassifier` function from the service client factory, giving each service control over what gets retried. |
| 10 | **No circuit breaker** | The CLI is not a long-running service. Commands run a short sequence of operations and exit. Retry-with-backoff handles transient failures. The one exception (app logs polling) uses simple interval scaling, not a circuit breaker. |
| 11 | **CDN/binary downloads stay outside the pipeline** | Raw `fetch()` for `cdn.shopify.com`, `cdn.jsdelivr.net`, GitHub, etc. These have no auth, no rate limiting, no retry requirement. The pipeline is for Shopify API calls. This is a documented escape hatch, not a gap. |
| 12 | **Compound client for multi-endpoint services** | Business Platform has two base URLs (destinations, organizations). The factory returns `{ destinations: GraphQLClient, organizations: (orgId) => GraphQLClient }`. Both sub-clients share middleware configuration. Documented as a recognized pattern. |
| 13 | **Mode-based transport selection, not direct injection** | Service clients accept `mode: 'production' \| 'development' \| 'test'` instead of a raw `Transport`. The mode determines transport, resilience behavior, and observability. This keeps the consumer API simple -- callers say *what context they're in*, not *how to wire the plumbing*. The mock transport is accessible via `configureMockTransport()` for test setup. Mode is inferred from environment by default so production code never needs to specify it. |
| 14 | **One client per protocol, not per service** | Admin GraphQL and Admin REST are separate factories (`createAdminGraphQLClient`, `createAdminRestClient`) despite sharing the same session and API version. Mixing protocols in one client obscures what kind of network call a consumer is making. Separate clients make the dependency graph explicit: a function importing `createAdminRestClient` obviously makes REST calls. Shared construction logic lives in an internal `resolveAdminConfig` helper. |
| 15 | **Identity/OAuth gets a dedicated client** | Device authorization, token exchange, and token refresh are currently scattered across private session modules with raw `shopifyFetch` calls. A dedicated `IdentityClient` gives these flows retry, observability, and testability. It is consumed by `SessionCoordinator`, not called directly by consumers. See [API_SESSION_DESIGN.md](./API_SESSION_DESIGN.md). |
| 16 | **Storefront rendering gets a dedicated client** | Theme dev's storefront rendering currently uses inline `fetch()` with hand-built headers. A `RestClient`-based factory gives it the same retry, observability, and testability as other services. It shares the Theme Access proxy routing pattern with the Admin clients. |
| 17 | **Every audit service is accounted for** | The 25 services in API_AUDIT.md map to: 11 service client factories, 2 non-pipeline clients (polling, WebSocket), CDN/binary downloads as documented escape hatches, Bugsnag/OTEL as orthogonal infrastructure, and SSE/search/password-check as correctly excluded (inline or server-side). No service is silently unaddressed. |
