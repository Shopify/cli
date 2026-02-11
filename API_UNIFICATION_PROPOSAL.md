# API Unification Proposal

> **Date:** 2026-02-09
> **Context:** Based on the comprehensive audit documented in [API_AUDIT.md](./API_AUDIT.md)
> **Goal:** Define the problems, risks, and solution criteria for unifying API call patterns across the Shopify CLI

---

## Current State

The CLI makes outbound calls to 25 distinct services using 5 different calling patterns, 3 different retry strategies, 2 different rate limiting approaches, and no shared observability for non-GraphQL calls. The GraphQL layer in `cli-kit` is well-designed and consistent. Everything else is ad hoc.

---

## Fragmentation

### 1. Five coexisting HTTP call patterns

| Pattern | Where used | Retry | Rate limit | Logging | Token refresh |
|---------|-----------|-------|------------|---------|---------------|
| `graphqlRequestDoc()` with typed documents | App Management, App Dev, Business Platform, Functions, Webhooks | Exponential backoff | Bottleneck 10/sec | Request ID, debug log, variable masking | UnauthorizedHandler on 401 |
| `graphqlRequest()` with inline `gql` strings | 26+ Partners operations in `app/src/cli/api/graphql/*.ts` | Same core, but operations defined as raw strings | Same | Same | Same |
| `shopifyFetch()` | Storefront rendering, password verification, REST Admin | Configurable via `RequestBehaviour` presets | Theme-specific throttler only | Partial | None |
| Raw `fetch()` | CDN downloads, template fetches, local webhook delivery, extension templates | None | None | None | None |
| SDK-managed | Bugsnag, OpenTelemetry | SDK-internal | SDK-internal | SDK-internal | N/A |

A developer adding a new API call has no clear signal which pattern to use. The "right" choice depends on whether the target is a Shopify GraphQL API (use the typed client), a Shopify REST endpoint (use `shopifyFetch` maybe), or anything else (roll your own `fetch`).

### 2. Dual-client architecture as migration debt

`PartnersClient` and `AppManagementClient` implement the same 44-method `DeveloperPlatformClient` interface against different backends. This means:

- **Duplicated GraphQL operations.** Deploy, release, app lookup, store lookup, and version management each exist in both Partners and App Management schemas with subtly different field shapes.
- **Mixed operation styles.** App Management operations use `.graphql` files with codegen'd TypeScript types. Partners operations are mostly inline `gql` template strings in `.ts` files with hand-written type interfaces.
- **Feature asymmetry.** App Management supports atomic deployments, dev sessions, and store search. Partners does not. The interface papers over this with runtime checks and capability flags (`supportsAtomicDeployments`, `supportsDevSessions`).
- **Maintenance burden grows with every new feature.** Any new API operation must consider both client paths, even though Partners is headed toward deprecation.

### 3. REST calls have no shared infrastructure

| REST caller | Retry logic | Error handling | Rate limiting |
|-------------|-------------|---------------|---------------|
| Admin REST (`restRequest`) | Network-level retry via `shopifyFetch` | 403/401/404 mapped to `AbortError` | Theme-specific throttler (5 parallel, header-based) |
| Storefront Rendering | None (raw `fetch`) | Status code check, custom error wrapping | None |
| Password Verification | None (raw `shopifyFetch`) | 429 check with `retry-after` | None |
| App Logs Polling | Custom retry loop (450ms/5s/60s) | 401 triggers resubscribe, 429 triggers backoff | Custom per-endpoint |
| Local Webhook Delivery | None (raw `fetch`) | Status code check only | None |

Each REST caller implements its own fetch-retry-parse cycle. The REST throttler in `rest-api-throttler.ts` is hardcoded to a `THEME_CONTEXT` and isn't used by any non-theme REST call.

### 4. CDN and binary downloads are unmanaged

Six CDN/download endpoints are called with raw `fetch()` or `downloadFile()`:

| Endpoint | Failure behavior | Fallback |
|----------|-----------------|----------|
| `cdn.shopify.com` (theme skeleton) | Throws | None |
| `cdn.shopify.com` (notifications) | Silent fail | Cached locally |
| `cdn.shopify.com` (extension templates) | `AbortError` with message | None |
| `cdn.shopify.com` (Javy WASM) | Throws | None |
| `cdn.jsdelivr.net` (binaryen) | Throws | None |
| `unpkg.com` (Polaris CSS) | Embedded in error page HTML | None |
| GitHub releases/raw (Dawn, mkcert, cloudflared) | Throws | Dawn has a CDN fallback URL |

No shared retry. No shared timeout. No caching (except notifications). No telemetry. Failures surface as generic errors with no guidance.

### 5. Theme package operates as an island

Theme operations differ from app operations in every dimension:

| Dimension | App operations | Theme operations |
|-----------|---------------|-----------------|
| Auth model | OAuth device flow, token exchange per API | Theme Access tokens (`shptka_` prefix) or admin session |
| API routing | Direct to service FQDN | Proxied through `theme-kit-access.shopifyapps.com` |
| Rate limiting | Bottleneck (10/sec per service) | Parallel request counter + API header tracking (5 parallel, 4s backoff near limit) |
| Retry behavior | Exponential backoff, configurable max | 90-second retry window, theme-specific `NetworkBehaviour` |
| File sync | Atomic version deployment (Brotli bundle) | Checksum-based diffing with batch upload (20 files/1MB per batch) |

---

## Risks

### Inconsistent failure modes

When the network is degraded, a user sees different behavior depending on which code path they're on:
- GraphQL calls retry with backoff for up to 90 seconds (theme) or until `maxRetryTimeMs` (default 30s)
- A CDN fetch for extension templates fails immediately with an `AbortError`
- App logs polling retries at 5-second intervals indefinitely
- A storefront rendering call fails silently and returns a broken page

There is no unified "the network is having problems" experience. The same underlying condition (e.g., DNS resolution failure) produces different error messages, different retry behaviors, and different recovery paths depending on which command is running.

### Token refresh divergence

The `createUnauthorizedHandler` correctly deduplicates concurrent refresh attempts using a WeakMap. But:
- Partners operations pass tokens as plain strings through `partnersRequest()`
- App Management operations use the handler through `appManagementRequestDoc()`
- Theme operations use `AdminSession.refresh` callback
- App logs polling manages its own JWT lifecycle with a `onResubscribe()` callback

A token expiring mid-operation follows a different recovery path in each case.

### Observability gaps

| Call type | Request ID | Debug logging | Monorail timing | OTEL spans |
|-----------|-----------|---------------|-----------------|------------|
| GraphQL | Yes (`x-request-id`) | Yes (URL, query, sanitized vars) | `cmd_all_last_graphql_request_id` | Unknown |
| REST Admin | No | Partial (via `shopifyFetch`) | No | No |
| Storefront Rendering | No | Manual `outputDebug` | No | No |
| CDN downloads | No | No | No | No |
| App Logs polling | No | No | No | No |

If a `theme push` is slow because the storefront rendering proxy is timing out, or `app deploy` stalls because `cdn.shopify.com` is slow to return the extension templates JSON, there is no telemetry to surface it. Only GraphQL calls are systematically observable.

### Rate limiting is per-service, not global

Each Shopify GraphQL API gets its own Bottleneck instance (10 req/sec). A command like `app dev` hits App Management, App Dev, Admin, and Business Platform simultaneously, each with independent limiters. Total outbound request volume is unbounded. There is no shared backpressure mechanism, no circuit breaker, and no way to detect when the CLI is collectively overwhelming a user's network or a shared infrastructure component.

### Third-party availability is a silent dependency

| Service | Used for | If unavailable |
|---------|----------|----------------|
| GitHub API | Release version checks | Stale version warnings or silent skip |
| GitHub Downloads | Dawn theme, mkcert, cloudflared binaries | `app dev` and `theme init` fail |
| npm Registry | CLI update checks | Silent skip |
| jsDelivr | Binaryen WASM optimizer | Function builds fail |
| unpkg | Polaris CSS for error pages | Unstyled error pages (cosmetic) |

None of these have fallbacks (except Dawn theme ZIP which tries a CDN fallback). Failures produce generic error messages that don't tell the user "GitHub is unreachable" or suggest workarounds like offline mode.

### Sensitive data exposure surface

Sensitive data masking is inconsistent:
- GraphQL debug logs mask `authorization`, `token`, `subject_token` headers and `apiKey`, `serialized_script` variables
- URL sanitization masks `subject_token` and `token` query params
- REST calls and CDN downloads have no systematic masking
- Storefront session cookies are passed through proxy code without masking in debug output

---

## Solution Criteria

A unified API call pattern should satisfy these requirements, roughly in priority order:

### 1. Single entry point for all outbound HTTP

Every outbound request -- GraphQL, REST, file download -- should flow through one function (or a small family of functions built on the same core). This function handles:
- **Timeout** with a consistent default (currently 30s) and per-call override
- **Retry** with exponential backoff for transient network errors, honoring `retry-after` headers
- **Cancellation** via AbortSignal for long-running commands
- **Debug logging** with URL, method, timing, and response status
- **Sensitive data masking** for all headers, query params, and request bodies

The current `shopifyFetch()` is close to this but lacks retry-by-default, debug logging, and masking for non-GraphQL calls.

### 2. Consistent error classification

All outbound call failures should be classified into a small set of categories with standardized user-facing messages:

| Category | Examples | User message pattern |
|----------|---------|---------------------|
| Transient network | DNS, timeout, connection reset | "Network error. Retrying..." / "Could not connect after N attempts." |
| Auth failure | 401, 403, expired token | "Authentication failed. Run `shopify auth login`." |
| Rate limited | 429, API limit headers | "Rate limited. Waiting N seconds..." |
| Service error | 5xx | "Shopify service error. Try again in a few minutes." |
| Client error | 4xx (non-auth) | Specific message from API response |
| External service unavailable | GitHub/npm/CDN down | "Could not reach {service}. Check your internet connection." |

The current codebase has this classification for GraphQL (`isTransientNetworkError`, `GraphQLClientError` vs `AbortError` for 4xx vs 5xx) but each REST/CDN caller reimplements its own version.

### 3. Unified token lifecycle

Token acquisition, caching, refresh, and injection should be managed by a single system rather than split across:
- `ensureAuthenticated*()` entry points
- `UnauthorizedHandler` callback
- `AdminSession.refresh` callback
- `AppManagementClient.unsafeRefreshToken()`
- Manual JWT management in app logs polling

Ideally: a request declares what auth context it needs (e.g., "Partners token" or "Admin token for store X"), and the infrastructure handles the rest -- including refresh, retry, and deduplication of concurrent refreshes.

### 4. Observability for all calls

Every outbound request should produce:
- A **debug log** line with method, URL (sanitized), status, and timing
- A **request ID** (from response headers or generated) stored for correlation
- A **timing metric** that feeds into Monorail analytics (e.g., `cmd_all_timing_network_ms`)
- An **OTEL span** when OTEL is configured

This is already done for GraphQL. Extending it to REST and CDN calls means the infrastructure team can see when theme pushes are slow due to REST throttling or when deploys stall on template fetches.

### 5. Graceful degradation for optional services

Classify each external call as **required** or **optional** for the current command:

| Call | Classification | Degraded behavior |
|------|---------------|-------------------|
| Shopify GraphQL APIs | Required | Fail with clear error |
| Admin REST | Required | Fail with clear error |
| Notifications fetch | Optional | Skip silently, use cache |
| npm version check | Optional | Skip silently |
| Extension templates fetch | Required for `extension create`, optional otherwise | Fail only when needed |
| CDN binary downloads | Required on first use | Cache after first download; fail with "run with internet first" |
| GitHub downloads | Required on first use | Same |

The infrastructure should support a `{ optional: true }` flag (or similar) that converts failures into warnings rather than errors.

### 6. Converge on typed GraphQL operations

The 26+ inline `gql` string operations in `app/src/cli/api/graphql/*.ts` should migrate to `.graphql` files with generated TypeScript types, matching the pattern already used by App Management, App Dev, Business Platform, Functions, and Webhooks operations. This eliminates hand-maintained type interfaces and makes the schema diffable.

### 7. Single rate limiting strategy

Replace the split between Bottleneck (GraphQL) and manual parallel-request counting (REST/theme) with a unified approach. Options:
- Extend Bottleneck to cover REST calls
- Build a per-domain rate limiter that covers all outbound calls to a given host
- At minimum, share backpressure signals so that hitting a rate limit on one API can slow down other APIs hitting the same infrastructure

### 8. Partners API sunset path

The `DeveloperPlatformClient` interface is the right abstraction. The migration path should:
- Stop adding new operations to `PartnersClient`
- Migrate remaining Partners-only operations to App Management equivalents
- Remove `PartnersClient` once all operations have App Management counterparts
- Clean up the 26+ inline GraphQL files that only serve the Partners path

---

## Non-goals

These are explicitly out of scope for a unified API pattern:

- **Changing which services exist.** The CLI will continue to call 7+ Shopify APIs. Unification is about *how* it calls them, not *what* it calls.
- **Redesigning the theme sync protocol.** Checksum-based file sync with batch uploads is a fundamentally different pattern from atomic version deployment. Both need to work. The goal is shared infrastructure underneath, not a single sync model.
- **Eliminating all third-party dependencies.** GitHub, npm, Cloudflare, and CDN downloads serve real purposes. The goal is managed failure, not removal.
