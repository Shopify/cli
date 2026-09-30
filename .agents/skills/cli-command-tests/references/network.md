# HTTP, GraphQL, and service-routing state

Apply these variants to the transport and callback actually used by a command. CLI GraphQL, OAuth HTTP, SDK traffic, and native schema fetch do not share one retry policy. The transport raises or returns a result; the caller decides whether to abort, recover, or render. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Fixture conventions

A response body alone is not enough. Record:

- Local configuration, flags, terminal mode, account type, and cache state.
- HTTP method, endpoint, operation name, variables, and relevant request headers.
- Response status, headers, body, delay, or transport exception.
- Response sequence for retries, polling, searches, and repeated release reads.
- Expected output, exit behavior, filesystem changes, and requests that must not happen.

Use synthetic IDs, emails, tokens, and secrets. Some output paths intentionally print credentials; never capture a real response for those fixtures. Treat each named row below as a fixture family: split alternatives such as null, omitted, and wrong-type values into individual cases.

The types below describe the fields selected or consumed by this checkout, not entire platform schemas. `?` follows generated optionality; `null` marks a nullable value. Malformed fixtures deliberately violate those types. GraphQL queries also select `__typename` on many objects; it is omitted below except where the client uses it as a discriminator.

All GraphQL data shapes go inside this HTTP response envelope:

```ts
type GraphQLSuccess<T> = {
  data: T
  extensions?: {
    deprecations: Array<{supportedUntilDate?: string}>
    [key: string]: unknown
  }
}

type GraphQLFailure<T> = {
  data?: T | null
  errors: Array<{
    message: string
    locations?: Array<{line: number; column: number}>
    path?: Array<string | number>
    extensions?: {
      code?: string | number
      app_errors?: {
        errors: Array<{category?: string; message?: string}>
      }
      [key: string]: unknown
    }
  }>
  extensions?: Record<string, unknown>
}
```

For a baseline response, omit `extensions` or use `{"deprecations": []}`. The App Management and Business Platform success callbacks assume that a present `extensions` object has an iterable `deprecations` member. An otherwise valid response with `extensions: {}` is a separate regression fixture.

Production endpoint aliases used below:

| Alias             | Endpoint                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| App Management    | `POST https://app.shopify.com/app_management/unstable/graphql.json`                          |
| Business Platform | `POST https://destinations.shopifysvc.com/destinations/api/2020-07/graphql`                  |
| Webhooks          | `POST https://app.shopify.com/webhooks/unstable/organizations/{organizationId}/graphql.json` |
| Identity          | `https://accounts.shopify.com`                                                               |

GraphQL requests send JSON with `query` and `variables`. Match the operation inside `query`, not just the URL: several calls share an endpoint. OAuth requests send URL-encoded bodies. Service hosts come from [fqdn.ts](/packages/cli-kit/src/public/node/context/fqdn.ts).

## Service routing, proxies, and retries

Sources: [bootstrap](/packages/cli/src/bootstrap.ts), [service environment](/packages/cli-kit/src/private/node/context/service.ts), [service hosts](/packages/cli-kit/src/public/node/context/fqdn.ts), [OAuth audience selection](/packages/cli-kit/src/private/node/session/identity.ts), [HTTP modes](/packages/cli-kit/src/public/node/http.ts).

| Variable                                         | Value rule                                        | Effect and fixtures                                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOPIFY_SERVICE_ENV`                            | Exactly `local`; everything else means production | Changes service discovery, OAuth client/audience IDs, session host namespace, and error-reporting behavior. Test unset, `production`, `local`, and misspelled values.                                                                              |
| `USING_DEV`                                      | Exactly `1`, captured at module load              | Required by the internal DevServer helper used for local service discovery. Does not select local routing on its own.                                                                                                                              |
| `SHOPIFY_HTTP_PROXY`                             | Nonempty proxy URL                                | Bootstrap configures `global-agent` with the `SHOPIFY_` namespace. Also serves as the HTTPS fallback when no HTTPS proxy is supplied.                                                                                                              |
| `SHOPIFY_HTTPS_PROXY`                            | Nonempty proxy URL                                | Overrides the HTTP proxy for HTTPS destinations. The dependency expects an `http:` proxy URL, even for HTTPS targets.                                                                                                                              |
| `SHOPIFY_NO_PROXY`                               | Dependency-parsed host/pattern list               | Excludes matching destinations from proxying. Test matching/nonmatching hosts, ports, wildcard entries, and malformed patterns.                                                                                                                    |
| `SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY`           | CLI truthy                                        | Disables connection-level retry. Does not disable GraphQL throttling retries or 401 refresh/replay.                                                                                                                                                |
| `SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS` | Nonempty numeric string, default `30000` ms       | Changes the default per-request abort timeout. Test valid milliseconds, empty/non-numeric fallback, zero, negative, fractional, infinite, and oversized values. Numeric conversion does not guarantee a value acceptable to `AbortSignal.timeout`. |

The bootstrap explicitly sets the proxy namespace, forced agent behavior, and a 60-second socket-connection timeout. `GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE`, `GLOBAL_AGENT_FORCE_GLOBAL_AGENT`, and `GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT` do not override those explicit values. Plain `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` are not substitutes for the Shopify-prefixed variables in this bootstrap, though external tools may read them independently.

Also control Node's `NODE_EXTRA_CA_CERTS`, `NODE_OPTIONS`, and any configured OpenSSL CA environment (`SSL_CERT_FILE`, `SSL_CERT_DIR` when applicable). These affect TLS or process startup, not Shopify flag defaults. Use `NODE_TLS_REJECT_UNAUTHORIZED` only in isolated negative tests, not as a fix for connection failures. Its effect depends on the transport and explicit agent options.

Proxy fixtures must run through bootstrap. Calling `info()` directly does not install the global proxy agent.

## Shared transport and GraphQL states

Account for these states on reachable GraphQL operations. Test common wrapper behavior once per materially different path, then verify operation-specific failure handling. Authentication and lifecycle HTTP calls use different wrappers; do not give them GraphQL retry behavior by default.

The status/retry rows describe the shared wrapper, not every caller's recovery policy. N1/N3 cache examples below belong to the [App Management profile](app-workflows.md), not every GraphQL query.

Sources: [GraphQL wrapper](/packages/cli-kit/src/public/node/api/graphql.ts), [retry logic](/packages/cli-kit/src/private/node/api.ts), [HTTP modes](/packages/cli-kit/src/public/node/http.ts), [error mapping](/packages/cli-kit/src/private/node/api/graphql.ts), [unauthorized handler](/packages/app/src/cli/utilities/developer-platform-client.ts).

### HTTP and GraphQL envelope cases

| Fixture                           | Response                                                                           | Behavior to assert                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transport/success`               | HTTP 200, valid `data`, no errors.                                                 | Operation-specific mapping runs.                                                                                                                             |
| `transport/graphql-error`         | HTTP 200 with `errors`.                                                            | Fails; HTTP success is not command success.                                                                                                                  |
| `transport/partial-data`          | Valid-looking `data` plus nonempty `errors`.                                       | `graphql-request` throws. A caller's handling of the error or partial data must be checked separately.                                                       |
| `transport/nested-app-errors`     | `extensions.app_errors.errors` within an error.                                    | Uses nested messages. `category: "access_denied"` gets the friendly permission message.                                                                      |
| `transport/message-fallback`      | Multiple errors, missing nested messages, or no usable messages.                   | Falls back to top-level messages, then serialized errors.                                                                                                    |
| `transport/401-recovered`         | HTTP 401 → refresh success → query success.                                        | One refresh/replay at this GraphQL wrapper level. Business Platform calls must use the refreshed Business Platform token.                                    |
| `transport/401-persistent`        | HTTP 401 before and after refresh.                                                 | Propagates the second failure, rather than repeatedly refreshing. N1 startup and N5 have separate caveats in the [App Management profile](app-workflows.md). |
| `transport/401-refresh-failed`    | HTTP 401 → refresh failure or no replacement token.                                | Stops; no successful replay. No-prompt reauthentication cannot open a browser.                                                                               |
| `transport/concurrent-401`        | Two queries on an initialized client return 401 together.                          | Shares an in-progress refresh for that client. Each query replays with the correct token type.                                                               |
| `transport/403`                   | HTTP 403.                                                                          | Permission error; no automatic token refresh.                                                                                                                |
| `transport/other-4xx`             | 400, 404, or another non-429 client error.                                         | Fails without status-based retries.                                                                                                                          |
| `transport/5xx`                   | 500/502/503, with JSON errors or an HTML proxy page.                               | No generic status-based 5xx retry. GraphQL client errors at 5xx map to `AbortError`; non-JSON parsing failures may surface differently.                      |
| `transport/429-recovered`         | HTTP 429, then success.                                                            | Retries; consumes `Retry-After` if present.                                                                                                                  |
| `transport/graphql-throttled`     | HTTP 200 with string `errors[].extensions.code: "THROTTLED"` or `"429"`.           | Retries even without HTTP 429.                                                                                                                               |
| `transport/numeric-throttle-code` | HTTP 200 with numeric `errors[].extensions.code: 429`.                             | Fails without a throttle retry. The current code scanner only collects string codes.                                                                         |
| `transport/throttled-exhausted`   | Persistent throttling.                                                             | Ten retries after the initial attempt, then failure, absent a separate 401 replay.                                                                           |
| `transport/bad-envelope`          | Empty body, malformed JSON, HTML, `{}`, or `data: null`.                           | Assert wrapper/parser failure; this is not an operation's nullable-record case. Any offline fallback must come from the caller.                              |
| `transport/content-type`          | JSON body with JSON, missing, or incorrect `Content-Type`; truncated encoded body. | Exercises the HTTP/GraphQL client's decoding, not the operation mapper.                                                                                      |
| `transport/redirect`              | Redirect to a valid endpoint, login HTML, or a redirect loop.                      | Exercise the HTTP client's redirect handling and final response parsing.                                                                                     |
| `transport/request-id`            | Error with/without `x-request-id`.                                                 | Includes the request ID where error mapping handles it. Never require that header for success.                                                               |

The current retry code parses `Retry-After` with `parseInt` and uses the result as **milliseconds**, not standard HTTP seconds. Preserve a regression fixture for a numeric value, missing header, HTTP-date value, and invalid value. Do not silently make the fixture server compensate for the unit mismatch.

GraphQL 401 handling depends on HTTP status. An HTTP 200 authentication error does not refresh credentials. Without a throttle code, it fails without a retry.

### Connection and timing cases

| Fixture                    | Network state                                                              | Behavior to assert                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `network/dns`              | `ENOTFOUND`, `EAI_AGAIN`, or `getaddrinfo` failure.                        | Recognized transient failures retry, then succeed or exhaust the retry window.                                               |
| `network/socket`           | Reset, refused connection, socket hangup, broken pipe, or premature close. | Same transient retry path when the error message matches.                                                                    |
| `network/unreachable`      | `ENETUNREACH` or timeout.                                                  | Retries recognized transient failures; no cached app-data fallback.                                                          |
| `network/tls`              | Certificate validation, hostname, or TLS failure.                          | A certificate-only failure is not transient and does not retry.                                                              |
| `network/slow`             | Response exceeds the request deadline.                                     | Default deadline is 30 seconds per attempt, configurable through `SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS`.           |
| `network/retry-disabled`   | Transient failure with `SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY=1`.           | No network-level retry. This does not disable GraphQL throttle retries.                                                      |
| `network/body-interrupted` | Headers arrive, then body stream fails.                                    | Test separately from connection failure. OAuth reads bodies outside its fetch retry block; GraphQL reads inside the request. |
| `network/one-service-down` | Only Identity, Business Platform, or App Management is unavailable.        | Fails at the first required uncached call to that service. A usable session can avoid Identity entirely.                     |

The default network retry window is 10 seconds, with backoff. It is not a hard command deadline: an in-flight request can outlast that window, and each attempt gets its own request timeout. Use controlled clocks/delays rather than waiting through real retry windows in tests.

OAuth uses `shopifyFetch`, which retries recognized connection failures but does not automatically retry HTTP 429/5xx responses. Those responses reach OAuth body handling. Other `fetch` calls default to no network retry unless they specify a different mode.

### Response extensions and cache states

These callback/cache details apply to the App Management and Business Platform client profile. Other APIs can use different callbacks, keys, and TTLs. A GraphQL response is not universally required to carry `deprecations`.

| Fixture                           | Variation                                                           | Expected behavior                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extensions/absent`               | No response `extensions`.                                           | Success callback does nothing.                                                                                                                                                                                       |
| `extensions/deprecations-empty`   | `deprecations: []`.                                                 | No deprecation date.                                                                                                                                                                                                 |
| `extensions/deprecations-dated`   | Future, imminent, expired, and invalid `supportedUntilDate` values. | Stores the earliest future date and warns after a successful command. Past/invalid dates do not set a warning date. [Timezone and runtime locale](lifecycle.md#deprecation-warning-dates) change the displayed date. |
| `extensions/missing-deprecations` | `extensions: {}` or cost-only metadata.                             | Current App Management/Business Platform callbacks can throw while iterating missing `deprecations`.                                                                                                                 |
| `cache/fresh`                     | N1/N3 cached within six hours.                                      | Skips the corresponding HTTP request, including its response callback.                                                                                                                                               |
| `cache/expired`                   | Exactly at or beyond TTL.                                           | Refetches; only ages strictly below TTL are fresh.                                                                                                                                                                   |
| `cache/negative-result`           | Fresh cached null account/organization.                             | Replays the same unknown-account/not-found behavior without a live query.                                                                                                                                            |
| `cache/corrupt-json`              | Cached value is not valid JSON.                                     | Cached-result parsing fails; it does not refetch automatically.                                                                                                                                                      |
| `cache/account-switch`            | Same query/variables under a different account.                     | N1 separates users; N3 has no user extra key.                                                                                                                                                                        |

A local cached app ID/title is not a cached N2 response. In the linked-context profile, seeding app preferences does not remove required app/specification requests.
