# Authentication and account state

Use the session/store records for commands that reach CLI-kit user authentication. The App Management/Business Platform profile below is narrower: its audience set, automation flow, and expiry asymmetry are not universal Admin or theme authentication rules. Each caller must declare its required APIs and alias behavior. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Credentials and account selection

Sources: [session flags and helpers](/packages/cli-kit/src/public/node/session.ts), [environment getters](/packages/cli-kit/src/public/node/environment.ts), [session orchestration](/packages/cli-kit/src/private/node/session.ts), [session store](/packages/cli-kit/src/private/node/session/store.ts).

| Variable                       | Value rule                                             | Effect and fixtures                                                                                                                              |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SHOPIFY_FLAG_AUTH_ALIAS`      | Nonempty string through oclif                          | Equivalent to `--auth-alias`. Test existing alias, exact user ID, unknown alias, case mismatch, empty value, and argv override.                  |
| `SHOPIFY_APP_AUTOMATION_TOKEN` | String; selected with `??`, then tested for truthiness | Supplies the token for App Management and Business Platform exchanges. Preferred over the legacy variable even when both are set.                |
| `SHOPIFY_CLI_PARTNERS_TOKEN`   | Fallback string                                        | Legacy automation-token name. Used only when `SHOPIFY_APP_AUTOMATION_TOKEN` is undefined; the newer variable set to `""` prevents this fallback. |
| `SHOPIFY_CLI_IDENTITY_TOKEN`   | Requires this and the refresh variable to be nonempty  | During full user auth, uses the supplied identity token instead of the browser/device flow. Application-token exchanges still run.               |
| `SHOPIFY_CLI_REFRESH_TOKEN`    | Paired with identity token                             | One variable alone does not activate the environment-token path. Existing usable sessions can avoid full auth and ignore the pair.               |

Account-alias selection happens before app context. An invalid alias can abort even if an automation token would otherwise authenticate successfully. A valid alias does not force the combined API helper to prefer stored user credentials over an automation token.

Organization selection during linking uses `ensureAuthenticatedBusinessPlatform()` separately from the combined automation-token helper. Keep that distinction from the [network authentication cases](#authentication-calls).

Test fake credentials only. Missing, expired, malformed, and unauthorized token responses belong in network fixtures; variables determine which flow reaches them.

## Stored sessions and selected account

### Outer store and decoded session shape

The authentication fields are a subset of the CLI-kit store:

```ts
type StoredAuthentication = {
  sessionStore?: string // JSON.stringify(decoded sessions), not a nested object.
  currentSessionId?: string
  devSessionStore?: string
  currentDevSessionId?: string
}

type StoredIdentityToken = {
  accessToken: string
  refreshToken: string
  expiresAt: string // Serialized date; parsed into a Date when loaded.
  scopes: string[]
  userId: string
  alias?: string
}

type StoredApplicationToken = {
  accessToken: string
  expiresAt: string
  scopes: string[]
  storeFqdn?: string
}

type StoredSession = {
  identity: StoredIdentityToken
  applications: Record<string, StoredApplicationToken>
}

type DecodedSessions = Record<string, Record<string, StoredSession>>
// First key: identity host, such as accounts.shopify.com.
// Second key: user ID.
```

Production routing reads `sessionStore` and `currentSessionId`. Local-service routing reads `devSessionStore` and `currentDevSessionId` from the same store. Decoded sessions are also separated by identity host. A session under another host is not a fallback for the active host.

Application-map keys are service audience IDs returned by `applicationId()`, not literal labels such as `"app-management"`. The App Management client requests App Management and Business Platform tokens. Admin/store authentication is a separate profile; existing Admin entries do not themselves select a store for this client.

The session parser validates the entire decoded map. One malformed account or application token, even in an otherwise unused entry, can invalidate the map. Invalid JSON, missing required fields, or an invalid expiry date causes removal of the active session-store field **and** its current-session ID. Other CLI-kit fields and the other service environment's session fields are not deleted by that removal.

This differs from a valid empty map or an absent/empty string: those do not trigger the same invalid-session cleanup. The schema accepts arbitrary strings for tokens and aliases; it does not prove credentials are usable.

Sources: [outer fields](/packages/cli-kit/src/private/node/conf-store.ts), [session schema](/packages/cli-kit/src/private/node/session/schema.ts), [validation and removal](/packages/cli-kit/src/private/node/session/store.ts), and [audience IDs](/packages/cli-kit/src/private/node/session/identity.ts).

### Account-selection order

Before app loading, flag parsing resolves `--auth-alias` or `SHOPIFY_FLAG_AUTH_ALIAS` against stored sessions for the active identity host. Matching is exact and case-sensitive against either `identity.alias` or the user-ID map key. The first matching entry wins; duplicate aliases do not produce an account picker.

A successful alias lookup sets a **process-local selection**. It does not change the persisted default. An unknown alias aborts with `No authenticated account found for alias …` before loading the app, even when an automation token could otherwise authenticate.

For normal user authentication, the session helper chooses:

1. The command's resolved alias/user-ID selection.
2. The stored current-session ID.
3. The first user key from `Object.keys(sessions[identityHost])`, if neither selection exists.

This is object-key enumeration order, not “most recently used.” A saved ID that points to a missing user does **not** fall back to the first available account: it leaves the selected session missing and reaches full authentication. There is no automatic multi-account prompt at this selection step.

Usable session reuse does not write a new current-session ID merely because the helper fell back to the first account. Full authentication or refresh saves the updated sessions; it updates the persisted selected ID only when no command-local account was selected.

Sources: [flag parsing](/packages/cli-kit/src/public/node/base-command.ts), [alias selection](/packages/cli-kit/src/public/node/session.ts), [alias matching](/packages/cli-kit/src/private/node/session/store.ts), and [authentication orchestration](/packages/cli-kit/src/private/node/session.ts).

### Reuse, refresh, and reauthentication

The local validator checks identity scopes and token expiry. It does not validate tokens with the service before returning them.

- Missing sessions, insufficient identity scopes, or an identity containing the exact `employee` scope require full authentication.
- Expired identity or App Management tokens, including a missing App Management token, require refresh when identity scopes are otherwise sufficient.
- The expiry threshold is `Date.now() + 4 minutes`, using a strict `<` comparison. At a fixed clock, a token exactly at the threshold is not considered expired by this check.
- The scope list comes from `allDefaultScopes()`, not the app TOML's commerce scopes. Do not seed only `openid` or copy `access_scopes.scopes` into an otherwise “valid” identity fixture.
- Business Platform token expiry is not checked by this validator. A missing Business Platform token can reach the combined helper's missing-token `BugError`; an expired one can reach HTTP 401. Do not assume both APIs get identical proactive refresh behavior.

Full user auth and refresh exchange four application tokens: Partners, Storefront Renderer, Business Platform, and App Management. They do not exchange an Admin token without a store. A refresh `invalid_grant` can fall back to full auth; `invalid_request` clears session state and aborts. Network response details belong in [authentication fixtures](#authentication-calls).

Sources: [validateSession](/packages/cli-kit/src/private/node/session/validate.ts), [scope calculation](/packages/cli-kit/src/private/node/session/scopes.ts), [expiry margin](/packages/cli-kit/src/private/node/constants.ts), and [refresh handling](/packages/cli-kit/src/private/node/session.ts).

### Session-state fixtures

| Fixture                             | Stored state                                                                   | Command effect                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `session/absent`                    | No active session-store field                                                  | Full auth unless an environment credential path applies.                                                                            |
| `session/usable`                    | Selected user, required scopes, and usable API tokens                          | Skips OAuth refresh/device auth. Domain API requests still run.                                                                     |
| `session/one-no-default`            | One valid user, no saved selected ID                                           | Uses that user without an account picker.                                                                                           |
| `session/multiple-no-default`       | Several valid users, no saved selected ID                                      | Uses the first enumerated user, not necessarily the newest.                                                                         |
| `session/saved-user`                | Saved ID identifies a user other than the first                                | Uses the saved user.                                                                                                                |
| `session/stale-selected-id`         | Saved ID has no matching user, but other valid users exist                     | Does not silently switch accounts; reaches full auth.                                                                               |
| `session/alias-override`            | Alias selects another user                                                     | Uses that account for this process; preserves the saved default.                                                                    |
| `session/alias-unknown`             | No alias/user-ID match in the active host                                      | Aborts before app loading.                                                                                                          |
| `session/alias-duplicate`           | Two entries share an alias                                                     | Uses the first matching entry.                                                                                                      |
| `session/other-host`                | Sessions exist only under another identity host                                | No reusable user for the active host.                                                                                               |
| `session/invalid-map`               | Malformed serialized data or one invalid nested account/token                  | Removes the active serialized map and selected ID. With an explicit alias, lookup then fails; without one, normal auth can proceed. |
| `session/expiry-boundary`           | Identity/App Management expiry before, at, and after the four-minute threshold | Selects refresh versus reuse according to the strict comparison.                                                                    |
| `session/identity-scopes`           | Missing required scope or `employee` present                                   | Full authentication rather than token reuse.                                                                                        |
| `session/app-management-missing`    | Identity is valid; required application entry absent                           | Refreshes.                                                                                                                          |
| `session/business-platform-missing` | Other checked tokens valid; Business Platform entry absent                     | Can fail at the combined helper rather than refreshing proactively.                                                                 |
| `session/business-platform-expired` | Only Business Platform token is expired                                        | Local expiry check can pass; exercise the API rejection/refresh path.                                                               |
| `session/empty-token`               | Schema-valid empty token string                                                | Not a valid success fixture. Missing-token guards or service rejection can still fail.                                              |
| `session/persist-fails`             | Refresh/login succeeds remotely, but session storage fails                     | Can fail after authentication requests complete but before the caller continues.                                                    |

Use synthetic credentials and a fixed clock. Do not read or copy the developer's real session store into a fixture.

## Authentication calls

Sources: [public session helpers](/packages/cli-kit/src/public/node/session.ts), [session orchestration](/packages/cli-kit/src/private/node/session.ts), [session validation](/packages/cli-kit/src/private/node/session/validate.ts), [OAuth exchange](/packages/cli-kit/src/private/node/session/exchange.ts).

### Authentication state determines the call sequence

| Initial state                                                                                                      | Network sequence                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored identity and required application tokens pass local validation                                              | No OAuth request. Continue to the caller's authenticated work, such as N1 or its cache entry. Local validation is not remote token introspection. |
| Identity or App Management token expires within the four-minute margin, or required App Management token is absent | Refresh identity token, then exchange application tokens.                                                                                         |
| No session, insufficient scopes, employee-scoped identity, or invalid cached identity structure                    | Start device authorization, poll for identity token, exchange application tokens, and optionally fetch email.                                     |
| Full auth with `SHOPIFY_CLI_IDENTITY_TOKEN` and `SHOPIFY_CLI_REFRESH_TOKEN`                                        | Skips device authorization/polling; still exchanges application tokens and may fetch email.                                                       |
| `SHOPIFY_APP_AUTOMATION_TOKEN` or legacy `SHOPIFY_CLI_PARTNERS_TOKEN`                                              | Exchanges first for App Management, then Business Platform. No device flow in this combined helper.                                               |
| API rejects an initialized client's token with HTTP 401                                                            | Refresh with `noPrompt: true, forceRefresh: true`, then retry the failed query once with the correct API token.                                   |

In this no-store user-auth profile, full authentication and refresh exchange **four** application tokens concurrently: Partners, Storefront Renderer, Business Platform, and App Management. The caller may only use some of them. A store-auth profile can request Admin credentials and needs its own audience/scope cases.

For the combined App Management/Business Platform profile, the local validator does not check Business Platform token expiry. Test an expired or absent Business Platform token separately from an expired App Management token. A later missing-token check or HTTP 401 may be the first sign of failure.

### A1: Device authorization

**Request:** `POST https://accounts.shopify.com/oauth/device_authorization` with URL-encoded `client_id` and space-delimited `scope`.

Source: [device-authorization.ts](/packages/cli-kit/src/private/node/session/device-authorization.ts).

```ts
type DeviceAuthorizationBody = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval?: number
}
```

| Fixture                          | Response variation                                          | Expected behavior                                                                                                              |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `device/start`                   | JSON with the fields above.                                 | Prints verification information, attempts to open the browser, then polls.                                                     |
| `device/default-interval`        | `interval` omitted.                                         | Polls initially after five seconds.                                                                                            |
| `device/custom-interval`         | Explicit interval.                                          | Uses that interval.                                                                                                            |
| `device/missing-required-fields` | Missing/empty `device_code` or `verification_uri_complete`. | Throws `BugError: Failed to start authorization process`.                                                                      |
| `device/other-fields-missing`    | Missing user code, base URI, or expiry.                     | Only the two fields above have explicit presence checks. Record current behavior rather than assuming full schema validation.  |
| `device/non-json`                | HTML, empty body, or invalid JSON; test 4xx and 5xx too.    | Throws a parse `BugError` with status/body-specific context.                                                                   |
| `device/body-read-failure`       | Headers arrive but reading the body throws.                 | Throws the network/streaming `BugError`.                                                                                       |
| `device/error-status-json`       | Non-2xx with valid JSON.                                    | This function checks required fields, not `response.ok`; missing fields fail, but a complete success-shaped body can continue. |
| `device/ci`                      | Valid device response in CI.                                | Aborts before polling. The device-authorization request has already happened.                                                  |

The browser's requests to `verification_uri_complete` are outside the CLI HTTP fixture boundary. Simulate their result through A2 polling responses.

### A2: Device-code polling

**Request:** `POST https://accounts.shopify.com/oauth/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`, `device_code`, and `client_id`.

Successful identity-token body:

```ts
type IdentityTokenBody = {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
  id_token: string
}

type OAuthErrorBody = {
  error: string
  error_description?: string
}
```

Use a synthetic JWT with a `sub` claim for `id_token`. This code decodes the JWT to get the user ID; a placeholder that is not JWT-shaped will fail.

| Fixture                     | Status/body sequence                                                   | Expected behavior                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `poll/success`              | 2xx identity token.                                                    | Continues to application-token exchanges.                                                                                                                                     |
| `poll/pending-then-success` | Non-2xx `authorization_pending`, then success.                         | Waits the current interval and polls again.                                                                                                                                   |
| `poll/slow-down`            | Non-2xx `slow_down`, then pending/success.                             | Adds five seconds to the interval for each `slow_down`.                                                                                                                       |
| `poll/denied`               | Non-2xx `access_denied`.                                               | Rejects with access-denied `AbortError`.                                                                                                                                      |
| `poll/expired`              | Non-2xx `expired_token`.                                               | Rejects with token-expired `AbortError`.                                                                                                                                      |
| `poll/unknown-error`        | Unrecognized error code or malformed error field.                      | Maps to `unknown_failure` and rejects.                                                                                                                                        |
| `poll/never-completes`      | Repeated pending responses.                                            | There is no local deadline based on A1's `expires_in`; the server must return expiry. Give the test its own deadline.                                                         |
| `poll/invalid-success`      | Missing `id_token`, JWT without `sub`, or malformed JWT.               | Identity construction fails.                                                                                                                                                  |
| `poll/throw-during-request` | Transport exception, invalid JSON, or identity-construction exception. | Regression case: the async timer callback has no catch forwarding thrown errors to the outer promise. Assert bounded process behavior rather than assuming a clean rejection. |

OAuth error codes are interpreted only for non-2xx responses. A 200 `{"error":"authorization_pending"}` is a malformed success body, not a pending poll.

### A3: Identity refresh

**Request:** `POST https://accounts.shopify.com/oauth/token` with `grant_type=refresh_token`, `access_token`, `refresh_token`, and `client_id`.

The success body has `access_token`, `expires_in`, `refresh_token`, and `scope`, as in A2. `id_token` is optional here because refresh preserves the existing user ID and alias.

| Fixture                     | Response variation                            | Expected behavior                                                                                                 |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `refresh/success`           | Valid new identity token.                     | Exchanges new application tokens and stores the updated session.                                                  |
| `refresh/invalid-grant`     | Non-2xx `invalid_grant`.                      | Initial authentication falls back to full auth. A forced no-prompt refresh clears credentials and aborts instead. |
| `refresh/invalid-request`   | Non-2xx `invalid_request`.                    | Clears stored sessions and aborts with the auth-validation error.                                                 |
| `refresh/invalid-target`    | Non-2xx `invalid_target`.                     | Throws the existing authorization error; no full-auth fallback.                                                   |
| `refresh/other-error`       | Other non-2xx OAuth code.                     | Throws an `AbortError` for the code.                                                                              |
| `refresh/non-json`          | HTML, empty body, or invalid JSON.            | Throws the authentication-service parse `AbortError`.                                                             |
| `refresh/malformed-success` | Missing/wrong token, expiry, or scope fields. | No complete runtime response validation. For example, missing `scope` fails at `.split()`.                        |

The initial refresh `try` block includes application-token exchange, so `invalid_grant` and `invalid_request` from A4 can trigger these same recovery branches.

### A4: Application-token exchange

**Request:** `POST https://accounts.shopify.com/oauth/token`, once per audience.

```ts
type TokenExchangeForm = {
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange"
  requested_token_type: "urn:ietf:params:oauth:token-type:access_token"
  subject_token_type: "urn:ietf:params:oauth:token-type:access_token"
  client_id: string
  audience: string
  scope: string
  subject_token: string
}

type ApplicationTokenBody = {
  access_token: string
  expires_in: number
  scope: string
  refresh_token?: string
  id_token?: string
}
```

Application-token construction consumes only `access_token`, `expires_in`, and `scope`. Audience IDs come from [identity.ts](/packages/cli-kit/src/private/node/session/identity.ts); scopes come from [scopes.ts](/packages/cli-kit/src/private/node/session/scopes.ts).

Cover success and independent failure for each of the four user-flow audiences, plus both sequential automation exchanges. Distinguish an App Management exchange failure from a Business Platform exchange failure: the automation helper names the failed API in its error.

All failures inside an automation exchange, including network and parse errors, become `The custom token provided can't be used for the … API.` User-flow exchanges preserve the OAuth error mapping described in A3. A failed member of the four-way `Promise.all` does not cancel requests already in progress.

Also cover:

- Non-2xx errors with a missing, empty, or non-string `error`: normalized to `unknown_error` for object-shaped bodies.
- A long `error_description`: only its first 200 characters reach the debug message.
- Null or otherwise malformed JSON bodies, and 2xx bodies with missing fields.
- Updated authorization headers after successful refresh; no credential values in fixture snapshots or debug logs.

### A5: `UserEmail`

**Endpoint:** Business Platform. **Variables:** none. **When:** full user authentication has produced application tokens and there is no existing alias to preserve. **Cache:** none. **401 refresh handler:** none.

Source: [fetchEmail and executeCompleteFlow](/packages/cli-kit/src/private/node/session.ts), [UserEmail query](/packages/cli-kit/src/private/node/api/graphql/business-platform-destinations/user-email.ts).

```ts
type UserEmailData = {
  currentUserAccount?: {email: string} | null
}
```

| Fixture                | Response variation                                        | Expected behavior                                                           |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `email/found`          | Email present.                                            | Uses it as the stored session alias.                                        |
| `email/no-account`     | Account null or omitted.                                  | Uses identity user ID as alias.                                             |
| `email/failure`        | Transport, HTTP, GraphQL, or response-processing failure. | Logs debug information and falls back to user ID; authentication continues. |
| `email/existing-alias` | Existing alias supplied to full reauthentication.         | No email query; preserves the alias.                                        |

`UserEmail` and `UserInfo` are distinct queries. A successful email lookup does not replace [N1](app-workflows.md#n1-userinfo), and an email failure does not imply N1 must fail.
