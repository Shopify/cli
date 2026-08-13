import type {AuthFetchResponse} from '../index.js'

type AuthErrorCode =
  | 'invalid_grant'
  | 'invalid_request'
  | 'invalid_target'
  | 'access_denied'
  | 'expired_token'
  | 'invalid_response'
  | 'app_not_installed'
  | 'unknown'
export interface AuthSignal {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void, options?: {once?: boolean}): void
  removeEventListener(type: 'abort', listener: () => void): void
}

export const fixtureOrigin = 'https://identity.example.test'
export const fakeClientId = 'fixture-client-id'

export type FixtureOperation =
  | 'device_authorization'
  | 'device_code_poll'
  | 'refresh_token'
  | 'token_exchange'
  | 'client_credentials'

export type FixtureExpected =
  | {kind: 'result'; value: Record<string, unknown>}
  | {kind: 'error'; code: AuthErrorCode | 'authorization_pending' | 'slow_down' | 'unknown_failure'; status?: number}

export interface AuthFixtureRequest {
  method: 'POST'
  url: string
  headers: Record<string, string>
  body: string
}

export interface AuthFixtureResponse {
  status: number
  body: string
}

export interface AuthFixture {
  readonly name: string
  readonly operation: FixtureOperation
  readonly request: AuthFixtureRequest
  readonly responses: ReadonlyArray<AuthFixtureResponse>
  /** Layer 2 only: the package conclusion is not a frozen contract. */
  readonly expected?: FixtureExpected
  /** Layer 2 only: cancellation is not accepted by cli-kit auth functions. */
  readonly signalExpectation: 'required' | 'optional' | 'absent'
  /** Layer 1 citation for the pinned request and raw response. */
  readonly transportCitation: string
  /** Layer 2 rationale/open question. */
  readonly provisionalOutcome?: string
  readonly redactedValues?: ReadonlyArray<string>
  readonly privateInputs?: ReadonlyArray<'device_code' | 'refresh_token' | 'client_secret' | 'subject_token'>
}

const json = (body: unknown, status = 200): AuthFixtureResponse => ({status, body: JSON.stringify(body)})
const formHeaders = {'Content-Type': 'application/x-www-form-urlencoded'}
const fakeIdentityResponse = {
  access_token: 'fixture-access-token',
  refresh_token: 'fixture-refresh-token',
  token_type: 'Bearer',
  scope: 'read_products write_products',
  expires_in: 7200,
  id_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlLXVzZXItMTIzNCJ9.Zml4dHVyZS1zaWduYXR1cmUtbm90LXZlcmlmaWVk',
}

const deviceAuthorizationResponse = {
  device_code: 'fixture-device-code',
  user_code: 'fixture-user-code',
  verification_uri: 'https://identity.example.test/verify',
  verification_uri_complete: 'https://identity.example.test/verify?code=fixture-user-code',
  expires_in: 599,
  interval: 5,
}

export const authFixtures: ReadonlyArray<AuthFixture> = [
  {
    name: 'device authorization start with scopes',
    operation: 'device_authorization',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/device_authorization`,
      headers: {'Content-type': formHeaders['Content-Type']},
      body: 'client_id=fixture-client-id&scope=read_products+write_products',
    },
    signalExpectation: 'optional',
    responses: [json(deviceAuthorizationResponse)],
    expected: {
      kind: 'result',
      value: {
        userCode: 'fixture-user-code',
        verificationUri: 'https://identity.example.test/verify',
        verificationUriComplete: 'https://identity.example.test/verify?code=fixture-user-code',
        interval: 5,
      },
    },
    transportCitation:
      'Identity app/operations/oauth/build_device_authorization_request_info.rb:20-27; live production capture',
    provisionalOutcome:
      'Whether adapters expose all response fields is undecided; expires_in is dynamic and this fixture value is an arbitrary fake; signal handling is also provisional.',
    redactedValues: ['fixture-device-code', 'fixture-user-code'],
    privateInputs: ['device_code'],
  },
  {
    name: 'device authorization start omits empty scope',
    operation: 'device_authorization',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/device_authorization`,
      headers: {'Content-type': formHeaders['Content-Type']},
      body: 'client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json(deviceAuthorizationResponse)],
    expected: {
      kind: 'result',
      value: {
        userCode: 'fixture-user-code',
        verificationUri: 'https://identity.example.test/verify',
        verificationUriComplete: 'https://identity.example.test/verify?code=fixture-user-code',
        interval: 5,
      },
    },
    transportCitation:
      'Identity app/operations/oauth/build_device_authorization_request_info.rb:20-27; live production capture',
    provisionalOutcome:
      'Empty-scope request and cancellation behavior require an adapter decision; expires_in is dynamic and this fixture value is an arbitrary fake.',
  },
  {
    name: 'device authorization malformed success',
    operation: 'device_authorization',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/device_authorization`,
      headers: {'Content-type': formHeaders['Content-Type']},
      body: 'client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json({user_code: 'fixture-user-code'})],
    transportCitation:
      'cli-kit packages/cli-kit/src/private/node/session/device-authorization.ts:57-60; characterization oracle packages/cli-kit/src/private/node/session/device-authorization.test.ts:224-230',
    provisionalOutcome:
      'Open question: cli-kit throws BugError for missing device fields; do not map this to AuthProtocolError.',
  },
  {
    name: 'device poll pending then success',
    operation: 'device_code_poll',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=fixture-device-code&client_id=fixture-client-id',
    },
    signalExpectation: 'required',
    responses: [
      json({error: 'authorization_pending', error_description: 'The authorization request is still pending.'}, 400),
      json(fakeIdentityResponse),
    ],
    expected: {kind: 'result', value: {status: 'complete'}},
    transportCitation:
      'Identity lib/rack/oauth2/server/token/extension/device_code.rb:35-64; Identity app/lib/token_server.rb:69-100; live production capture',
    provisionalOutcome: 'Polling and token mapping are provisional; cli-kit polls pending then decodes id_token.',
    redactedValues: ['fixture-device-code'],
    privateInputs: ['device_code'],
  },
  {
    name: 'device poll slow down',
    operation: 'device_code_poll',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=fixture-device-code&client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json({error: 'slow_down', error_description: 'Polling too frequently.'}, 400)],
    expected: {kind: 'error', code: 'slow_down', status: 400},
    transportCitation: 'Identity lib/rack/oauth2/server/token/extension/device_code.rb:35-64; live production capture',
    provisionalOutcome:
      'The response has no interval. cli-kit applies a fixed client-policy +5 seconds (packages/cli-kit/src/private/node/session/device-authorization.ts:129-134); this is not a server instruction. Signal behavior is provisional.',
  },
  {
    name: 'device poll access denied (defensive only)',
    operation: 'device_code_poll',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=fixture-device-code&client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json({error: 'access_denied', error_description: 'Access denied.'}, 400)],
    expected: {kind: 'error', code: 'access_denied', status: 400},
    transportCitation:
      'Identity lib/rack/oauth2/server/token/extension/device_code.rb:38-63 defines authorization_pending, slow_down, and expired_token only',
    provisionalOutcome:
      'No known device-flow path emits access_denied; this fixture retains it as a defensive cli-kit mapping. A generic access_denied from another token-endpoint layer is not ruled out.',
  },
  {
    name: 'device poll expired token',
    operation: 'device_code_poll',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=fixture-device-code&client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json({error: 'expired_token', error_description: 'The device code has expired.'}, 400)],
    expected: {kind: 'error', code: 'expired_token', status: 400},
    transportCitation: 'Identity lib/rack/oauth2/server/token/extension/device_code.rb:35-64; live production capture',
    provisionalOutcome: 'Error taxonomy and cancellation behavior remain provisional.',
  },
  {
    name: 'refresh preserves identity metadata',
    operation: 'refresh_token',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=refresh_token&access_token=fixture-current-access&refresh_token=fixture-current-refresh&client_id=fixture-client-id',
    },
    signalExpectation: 'optional',
    responses: [json(fakeIdentityResponse)],
    expected: {kind: 'result', value: {expiresAt: 1700003600000, userId: 'fixture-user-id', alias: 'fixture-alias'}},
    transportCitation: 'Identity app/lib/token_server.rb:69-100; live production capture',
    provisionalOutcome: 'Fixed expiry uses an injected clock of 1700000000000 ms. Metadata mapping is provisional.',
    redactedValues: ['fixture-current-access', 'fixture-current-refresh'],
    privateInputs: ['refresh_token'],
  },
  {
    name: 'refresh response omits refresh token',
    operation: 'refresh_token',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=refresh_token&access_token=fixture-current-access&refresh_token=fixture-current-refresh&client_id=fixture-client-id',
    },
    signalExpectation: 'absent',
    responses: [json({access_token: 'fixture-new-access', scope: 'read_products', expires_in: 300})],
    transportCitation: 'Identity app/lib/token_grants/refresh.rb:111-138 (refresh-token selection conditional)',
    provisionalOutcome:
      'Open question: cli-kit does not validate refresh_token presence, and Identity may omit it. Tolerant handling is not a frozen error mapping.',
    redactedValues: ['fixture-current-access', 'fixture-current-refresh'],
    privateInputs: ['refresh_token'],
  },
  {
    name: 'admin token exchange uses destination and store-qualified key',
    operation: 'token_exchange',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&requested_token_type=urn%3Aietf%3Aparams%3Aoauth%3Atoken-type%3Aaccess_token&subject_token_type=urn%3Aietf%3Aparams%3Aoauth%3Atoken-type%3Aaccess_token&client_id=fixture-client-id&audience=admin&scope=read_products&subject_token=fixture-identity-access&destination=https%3A%2F%2Fshop.example.test%2Fadmin&store=shop.example.test',
    },
    signalExpectation: 'absent',
    responses: [json({access_token: 'fixture-app-access', scope: 'read_products', expires_in: 300})],
    expected: {kind: 'result', value: {key: 'shop.example.test-admin'}},
    transportCitation:
      'cli-kit packages/cli-kit/src/private/node/session/exchange.ts:182-197 (admin destination and store-qualified key); Identity app/lib/token_grants/token_exchange.rb:59-71,82-88; Identity lib/rack/oauth2/server/token/extension/token_exchange.rb:23-43',
    provisionalOutcome:
      'Admin result shape is provisional; invalid_target is token-exchange-only, not a generic refresh error.',
    redactedValues: ['fixture-identity-access'],
    privateInputs: ['subject_token'],
  },
  {
    name: 'client credentials request',
    operation: 'client_credentials',
    request: {
      method: 'POST',
      url: 'https://shop.example.test/admin/oauth/access_token',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: 'fixture-app-id',
        client_secret: 'fixture-app-secret',
        grant_type: 'client_credentials',
      }),
    },
    signalExpectation: 'optional',
    responses: [json({access_token: 'fixture-client-access'})],
    expected: {kind: 'result', value: {expiresAt: 1700000300000}},
    transportCitation: 'cli-kit packages/cli-kit/src/public/node/session.ts:339-381',
    provisionalOutcome: 'Fixed expiry uses an injected clock of 1700000000000 ms. Error handling remains provisional.',
    redactedValues: ['fixture-app-secret'],
    privateInputs: ['client_secret'],
  },
  {
    name: 'malformed OAuth error',
    operation: 'token_exchange',
    request: {
      method: 'POST',
      url: `${fixtureOrigin}/oauth/token`,
      headers: formHeaders,
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&subject_token=fixture-identity-access',
    },
    signalExpectation: 'absent',
    responses: [json({error_description: 'fixture failure'}, 400)],
    transportCitation:
      'cli-kit packages/cli-kit/src/private/node/session/exchange.ts:262-267; characterization oracle packages/cli-kit/src/private/node/session/exchange.test.ts:412-425,465-471',
    provisionalOutcome:
      'Open question: cli-kit normalizes missing error to unknown_error and exchange throws AbortError; use malformed_response only for a body that does not parse.',
    redactedValues: ['fixture-identity-access'],
    privateInputs: ['subject_token'],
  },
]

export function isAuthSignal(value: unknown): value is AuthSignal {
  return typeof value === 'object' && value !== null && 'aborted' in value && 'addEventListener' in value
}

export type FixtureResponse = AuthFetchResponse
