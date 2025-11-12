# Shopify CLI Identity Authentication Flow Analysis

## Overview

This document traces the complete authentication flow in the Shopify CLI from entry point to completion, focusing specifically on interactions with the Identity service. Two scenarios are analyzed: first-time authentication (after `shopify auth logout`) and subsequent commands with cached sessions.

## Scenario 1: First-Time Authentication Flow (After Logout)

### Initial State
After running `shopify auth logout`:
- **File**: `packages/cli-kit/src/public/node/session.ts:281-283`
- **Action**: `logout()` calls `sessionStore.remove()`
- **File**: `packages/cli-kit/src/private/node/session/store.ts:39-42`
- **Result**: All session data and current session ID are cleared from local storage

### Step-by-Step Flow for Any Command Requiring Authentication

#### 1. Command Entry Point
**Example**: Any CLI command that needs Partners API access (e.g., `shopify app generate`)

#### 2. Domain-Specific Authentication Request
**File**: `packages/cli-kit/src/public/node/session.ts:104-122`
**Function**: `ensureAuthenticatedPartners(scopes, env, options)`

```typescript
export async function ensureAuthenticatedPartners(
  scopes: PartnersAPIScope[] = [],
  env = process.env,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<{token: string; userId: string}>
```

**Actions**:
1. Check for environment token (`getPartnersToken()`) - returns `undefined` after logout
2. Call `ensureAuthenticated({partnersApi: {scopes}}, env, options)`

#### 3. Core Authentication Orchestration
**File**: `packages/cli-kit/src/private/node/session.ts:195-277`
**Function**: `ensureAuthenticated(applications, _env, options)`

**Step 3.1**: Identity Service Discovery
```typescript
const fqdn = await identityFqdn()  // e.g., "accounts.shopify.com"
```

**Step 3.2**: Session State Check
```typescript
const sessions = (await sessionStore.fetch()) ?? {}
let currentSessionId = getCurrentSessionId()
// Both return empty/undefined after logout
```

**Step 3.3**: Session Validation
```typescript
const validationResult = await validateSession(scopes, applications, currentSession)
// Returns 'needs_full_auth' since currentSession is undefined
```

**Step 3.4**: Full Authentication Flow Trigger
```typescript
if (validationResult === 'needs_full_auth') {
  await throwOnNoPrompt(noPrompt)
  outputDebug(outputContent`Initiating the full authentication flow...`)
  newSession = await executeCompleteFlow(applications)
}
```

#### 4. Complete Authentication Flow Execution
**File**: `packages/cli-kit/src/private/node/session.ts:295-339`
**Function**: `executeCompleteFlow(applications)`

**Step 4.1**: Scope Preparation
```typescript
const scopes = getFlattenScopes(applications)      // ['openid', 'https://api.shopify.com/auth/partners.app.cli.access']
const exchangeScopes = getExchangeScopes(applications)
const store = applications.adminApi?.storeFqdn
```

**Step 4.2**: Device Authorization Request
```typescript
const deviceAuth = await requestDeviceAuthorization(scopes)
```

#### 5. Device Authorization Flow (Identity Service Interaction #1)
**File**: `packages/cli-kit/src/private/node/session/device-authorization.ts:32-108`
**Function**: `requestDeviceAuthorization(scopes)`

**Step 5.1**: Identity Service Endpoint Preparation
```typescript
const fqdn = await identityFqdn()                    // "accounts.shopify.com"
const identityClientId = clientId()                  // Environment-specific client ID
const queryParams = {client_id: identityClientId, scope: scopes.join(' ')}
const url = `https://${fqdn}/oauth/device_authorization`
```

**Step 5.2**: HTTP Request to Identity Service
```typescript
const response = await shopifyFetch(url, {
  method: 'POST',
  headers: {'Content-type': 'application/x-www-form-urlencoded'},
  body: convertRequestToParams(queryParams),
})
```

**Identity Service Call**: `POST https://accounts.shopify.com/oauth/device_authorization`
**Payload**: `client_id=<client-id>&scope=openid https://api.shopify.com/auth/partners.app.cli.access`

**Step 5.3**: Response Processing
```typescript
let responseText = await response.text()
let jsonResult = JSON.parse(responseText)
```

**Step 5.4**: User Interaction Setup
```typescript
outputInfo('\nTo run this command, log in to Shopify.')
outputInfo(outputContent`User verification code: ${jsonResult.user_code}`)
// Opens browser or shows URL for user to authorize
```

**Returns**: `DeviceAuthorizationResponse` with `deviceCode`, `userCode`, `verificationUri`, etc.

#### 6. Device Authorization Polling (Identity Service Interaction #2)
**File**: `packages/cli-kit/src/private/node/session/device-authorization.ts:121-159`
**Function**: `pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)`

**Step 6.1**: Polling Loop Setup
```typescript
let currentIntervalInSeconds = interval  // Default 5 seconds
return new Promise<IdentityToken>((resolve, reject) => {
  const onPoll = async () => {
    const result = await exchangeDeviceCodeForAccessToken(code)
    // Handle response states: 'authorization_pending', 'slow_down', success, errors
  }
})
```

**Step 6.2**: Token Exchange Request (per poll)
**File**: `packages/cli-kit/src/private/node/session/exchange.ts:141-158`
**Function**: `exchangeDeviceCodeForAccessToken(deviceCode)`

```typescript
const clientId = await getIdentityClientId()
const params = {
  grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  device_code: deviceCode,
  client_id: clientId,
}
const tokenResult = await tokenRequest(params)
```

**Step 6.3**: Core Token Request (Identity Service Interaction)
**File**: `packages/cli-kit/src/private/node/session/exchange.ts:226-238`
**Function**: `tokenRequest(params)`

```typescript
const fqdn = await identityFqdn()
const url = new URL(`https://${fqdn}/oauth/token`)
url.search = new URLSearchParams(Object.entries(params)).toString()

const res = await shopifyFetch(url.href, {method: 'POST'})
const payload = await res.json()
```

**Identity Service Call**: `POST https://accounts.shopify.com/oauth/token`
**Payload**: `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=<code>&client_id=<client-id>`

**Polling Behavior**:
- Initial requests return `authorization_pending` until user completes browser authorization
- Once authorized, returns `IdentityToken` with `accessToken`, `refreshToken`, `expiresAt`, `scopes`, `userId`

#### 7. Application Token Exchange (Identity Service Interactions #3-7)
**File**: `packages/cli-kit/src/private/node/session.ts:320`
**Function**: `exchangeAccessForApplicationTokens(identityToken, exchangeScopes, store)`

**File**: `packages/cli-kit/src/private/node/session/exchange.ts:31-53`

**Step 7.1**: Parallel Token Requests
```typescript
const token = identityToken.accessToken

const [partners, storefront, businessPlatform, admin, appManagement] = await Promise.all([
  requestAppToken('partners', token, scopes.partners),
  requestAppToken('storefront-renderer', token, scopes.storefront),
  requestAppToken('business-platform', token, scopes.businessPlatform),
  store ? requestAppToken('admin', token, scopes.admin, store) : {},
  requestAppToken('app-management', token, scopes.appManagement),
])
```

**Step 7.2**: Individual Application Token Request
**File**: `packages/cli-kit/src/private/node/session/exchange.ts:160-188`
**Function**: `requestAppToken(api, token, scopes, store)`

```typescript
const appId = applicationId(api)
const clientId = await getIdentityClientId()

const params = {
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
  requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
  subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
  client_id: clientId,
  audience: appId,
  scope: scopes.join(' '),
  subject_token: token,
  ...(api === 'admin' && {destination: `https://${store}/admin`, store}),
}

const tokenResult = await tokenRequest(params)
```

**Identity Service Calls** (one per API):
- `POST https://accounts.shopify.com/oauth/token` (Partners API)
- `POST https://accounts.shopify.com/oauth/token` (Storefront API)
- `POST https://accounts.shopify.com/oauth/token` (Business Platform API)
- `POST https://accounts.shopify.com/oauth/token` (App Management API)
- `POST https://accounts.shopify.com/oauth/token` (Admin API - if store specified)

**Example Partners API Payload**:
```
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&requested_token_type=urn:ietf:params:oauth:token-type:access_token
&subject_token_type=urn:ietf:params:oauth:token-type:access_token
&client_id=<client-id>
&audience=<partners-app-id>
&scope=https://api.shopify.com/auth/partners.app.cli.access
&subject_token=<identity-access-token>
```

#### 8. Session Creation and Storage
**File**: `packages/cli-kit/src/private/node/session.ts:322-338`

**Step 8.1**: Email Fetching (if Business Platform token available)
```typescript
const businessPlatformToken = result[applicationId('business-platform')]?.accessToken
const alias = (await fetchEmail(businessPlatformToken)) ?? identityToken.userId
```

**Step 8.2**: Session Object Creation
```typescript
const session: Session = {
  identity: {
    ...identityToken,
    alias,
  },
  applications: result,
}
```

**Step 8.3**: Session Persistence
**File**: `packages/cli-kit/src/private/node/session.ts:255-264`
```typescript
const completeSession = {...currentSession, ...newSession} as Session
const newSessionId = completeSession.identity.userId
const updatedSessions: Sessions = {
  ...sessions,
  [fqdn]: {...sessions[fqdn], [newSessionId]: completeSession},
}

await sessionStore.store(updatedSessions)
setCurrentSessionId(newSessionId)
```

#### 9. Token Return to Command
**File**: `packages/cli-kit/src/private/node/session.ts:265-276`
**Function**: `tokensFor(applications, completeSession)`

**Returns**: `OAuthSession` object with domain-specific tokens:
```typescript
{
  admin?: AdminSession,
  partners?: string,
  storefront?: string,
  businessPlatform?: string,
  appManagement?: string,
  userId: string
}
```

### Summary of Identity Service Interactions (First-Time Auth)
1. **Device Authorization Request**: `POST /oauth/device_authorization`
2. **Device Code Polling**: Multiple `POST /oauth/token` (device grant type) until authorized
3. **Partners Token Exchange**: `POST /oauth/token` (token exchange grant type)
4. **Storefront Token Exchange**: `POST /oauth/token` (token exchange grant type)
5. **Business Platform Token Exchange**: `POST /oauth/token` (token exchange grant type)
6. **App Management Token Exchange**: `POST /oauth/token` (token exchange grant type)
7. **Admin Token Exchange**: `POST /oauth/token` (token exchange grant type) - if store specified

**Total Identity Service Calls**: 6-7 HTTP requests

---

## Scenario 2: Subsequent Command with Cached Session

### Initial State
- Valid session exists in local storage
- Current session ID is set
- All application tokens are within expiry threshold

### Step-by-Step Flow

#### 1. Command Entry Point
**Example**: Same command (`shopify app generate`) executed again

#### 2. Domain-Specific Authentication Request
**File**: `packages/cli-kit/src/public/node/session.ts:104-122`
**Function**: `ensureAuthenticatedPartners(scopes, env, options)`

Same entry point as Scenario 1.

#### 3. Core Authentication Orchestration
**File**: `packages/cli-kit/src/private/node/session.ts:195-277`
**Function**: `ensureAuthenticated(applications, _env, options)`

**Step 3.1**: Identity Service Discovery
```typescript
const fqdn = await identityFqdn()  // "accounts.shopify.com"
```

**Step 3.2**: Session State Recovery
```typescript
const sessions = (await sessionStore.fetch()) ?? {}
let currentSessionId = getCurrentSessionId()  // Returns cached user ID
const currentSession = sessions[fqdn]?.[currentSessionId]  // Valid session object
```

**Step 3.3**: Session Validation
**File**: `packages/cli-kit/src/private/node/session/validate.ts:27-71`
**Function**: `validateSession(scopes, applications, currentSession)`

```typescript
const scopesAreValid = validateScopes(scopes, session.identity)
let tokensAreExpired = isTokenExpired(session.identity)

// Check each required application token
if (applications.partnersApi) {
  const appId = applicationId('partners')
  const token = session.applications[appId]
  tokensAreExpired = tokensAreExpired || isTokenExpired(token)
}

// Returns 'ok' if all tokens valid and not expired
// Returns 'needs_refresh' if expired but structure valid
// Returns 'needs_full_auth' if structure invalid
```

**Step 3.4**: Validation Result Handling
```typescript
// If validationResult === 'ok'
// Skip to Step 6 (Token Return)
```

#### 4. Token Refresh Flow (if tokens expired)
**If**: `validationResult === 'needs_refresh'`

**File**: `packages/cli-kit/src/private/node/session.ts:235-250`
**Function**: `refreshTokens(currentSession, applications)`

**Step 4.1**: Identity Token Refresh (Identity Service Interaction #1)
**File**: `packages/cli-kit/src/private/node/session/exchange.ts:57-68`
**Function**: `refreshAccessToken(currentToken)`

```typescript
const clientId = getIdentityClientId()
const params = {
  grant_type: 'refresh_token',
  access_token: currentToken.accessToken,
  refresh_token: currentToken.refreshToken,
  client_id: clientId,
}
const tokenResult = await tokenRequest(params)
```

**Identity Service Call**: `POST https://accounts.shopify.com/oauth/token`
**Payload**: `grant_type=refresh_token&access_token=<token>&refresh_token=<refresh-token>&client_id=<client-id>`

**Step 4.2**: Application Token Re-exchange (Identity Service Interactions #2-6)
```typescript
const exchangeScopes = getExchangeScopes(applications)
const applicationTokens = await exchangeAccessForApplicationTokens(
  identityToken,
  exchangeScopes,
  applications.adminApi?.storeFqdn,
)
```

Same parallel token exchange as Scenario 1, Step 7.

#### 5. Session Update and Storage
```typescript
const updatedSession = {
  identity: identityToken,
  applications: applicationTokens,
}
await sessionStore.store(updatedSessions)
```

#### 6. Token Return to Command
**File**: `packages/cli-kit/src/private/node/session.ts:265-276`
**Function**: `tokensFor(applications, completeSession)`

Returns cached or refreshed tokens to the calling command.

### Summary of Identity Service Interactions (Cached Session)

**If tokens are valid**: **0 HTTP requests** - all tokens returned from cache

**If tokens need refresh**: **5-6 HTTP requests**
1. **Identity Token Refresh**: `POST /oauth/token` (refresh grant type)
2. **Partners Token Exchange**: `POST /oauth/token` (token exchange grant type)
3. **Storefront Token Exchange**: `POST /oauth/token` (token exchange grant type)
4. **Business Platform Token Exchange**: `POST /oauth/token` (token exchange grant type)
5. **App Management Token Exchange**: `POST /oauth/token` (token exchange grant type)
6. **Admin Token Exchange**: `POST /oauth/token` (token exchange grant type) - if store specified

---

## Identity Service Interaction Patterns

### HTTP Endpoints Used
All requests go to: `https://{identityFqdn}/oauth/token` and `https://{identityFqdn}/oauth/device_authorization`

Where `identityFqdn` is typically `"accounts.shopify.com"`

### Grant Types Used
1. **Device Authorization**: `POST /oauth/device_authorization`
2. **Device Code Exchange**: `grant_type=urn:ietf:params:oauth:grant-type:device_code`
3. **Token Exchange**: `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`
4. **Refresh Token**: `grant_type=refresh_token`

### Request Patterns
- All token requests use the centralized `tokenRequest()` function
- All HTTP calls use `shopifyFetch()` wrapper
- All application token exchanges happen in parallel
- Error handling uses Result pattern with typed errors

### Key Extraction Points for Client Architecture
1. **Device Authorization**: `requestDeviceAuthorization()` and `pollForDeviceAuthorization()` functions
2. **Token Exchange**: `tokenRequest()` function (centralized HTTP interface)
3. **Session Management**: Session validation, storage, and lifecycle management
4. **Error Handling**: Token request error handling and retry logic
5. **Configuration**: Client ID and application ID management per environment

The current architecture shows clear separation between business logic and Identity service communication, with the `tokenRequest()` function serving as the primary HTTP interface to the Identity service. This function and the device authorization functions represent the core integration points that would be abstracted by an Identity service client.