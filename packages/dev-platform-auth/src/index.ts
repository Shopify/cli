export const PACKAGE_NAME = '@shopify/dev-platform-auth'

/** Epoch-millisecond credentials shared by auth adapters. */
export interface IdentityToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes: string[]
  userId: string
  alias?: string
}

export interface ApplicationToken {
  accessToken: string
  expiresAt: number
  scopes: string[]
  storeFqdn?: string
}

export type ShopifyApplication = 'admin' | 'partners' | 'storefront-renderer' | 'business-platform' | 'app-management'

export interface AuthClientConfig {
  identityOrigin: string
  clientId: string
  fetch?: AuthFetch
  clock?: Clock
  logger?: AuthLogger
}

export interface IdentityClientConfig extends AuthClientConfig {}

export interface ApplicationAccessConfig extends AuthClientConfig {
  applicationIds: Record<ShopifyApplication, string>
}

export interface AuthFetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

export interface AuthSignal {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void, options?: {once?: boolean}): void
  removeEventListener(type: 'abort', listener: () => void): void
}

export type AuthFetch = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
    signal?: AuthSignal
  },
) => Promise<AuthFetchResponse>

export interface Clock {
  now(): number
  sleep?(milliseconds: number, signal?: AuthSignal): Promise<void>
}

export type AuthLogEvent =
  | {
      event: 'device_authorization_started' | 'device_authorization_completed'
      application?: ShopifyApplication
    }
  | {
      event: 'device_authorization_pending' | 'device_authorization_slow_down'
      application?: ShopifyApplication
    }
  | {
      event: 'auth_protocol_error'
      code: AuthErrorCode
      status?: number
    }

export interface AuthLogger {
  debug(event: AuthLogEvent): void
}

export interface DeviceAuthorization {
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresIn: number
  interval?: number
}

export type DeviceCodeExchangeResult =
  | {status: 'complete'; token: IdentityToken}
  | {status: 'pending'}
  | {status: 'slow_down'}

export interface BaseApplicationTokenRequest {
  identityToken: string
  scopes: string[]
  signal?: AuthSignal
}

export type ApplicationTokenRequest =
  | (BaseApplicationTokenRequest & {
      application: 'admin'
      storeFqdn: string
    })
  | (BaseApplicationTokenRequest & {
      application: Exclude<ShopifyApplication, 'admin'>
      storeFqdn?: never
    })

export interface IdentityClient {
  requestDeviceAuthorization(options: {scopes: string[]; signal?: AuthSignal}): Promise<DeviceAuthorization>
  exchangeDeviceCode(options: {deviceCode: string; signal?: AuthSignal}): Promise<DeviceCodeExchangeResult>
  refreshIdentityToken(options: {token: IdentityToken; signal?: AuthSignal}): Promise<IdentityToken>
}

export interface ApplicationAccessClient {
  exchangeApplicationToken(request: ApplicationTokenRequest): Promise<ApplicationToken>
}

export interface ClientCredentialsTokenRequest {
  storeFqdn: string
  clientId: string
  clientSecret: string
  signal?: AuthSignal
}

export type ClientCredentialsError =
  | {kind: 'transport_failed'; cause: unknown}
  | {kind: 'malformed_response'; status: number; cause?: unknown}
  | {kind: 'unexpected_status'; status: number}
  | {serverCode: string; status: number}

export type ClientCredentialsResult = ApplicationToken | ClientCredentialsError

export interface ClientCredentialsClient {
  requestToken(options: ClientCredentialsTokenRequest): Promise<ClientCredentialsResult>
}

export type AuthErrorCode =
  | 'invalid_grant'
  | 'invalid_request'
  | 'invalid_target'
  | 'access_denied'
  | 'expired_token'
  | 'invalid_response'
  | 'app_not_installed'
  | 'unknown'

export interface AuthProtocolErrorOptions {
  status?: number
}

export {createClientCredentialsClient, requestClientCredentialsToken} from './client-credentials.js'

export class AuthProtocolError extends Error {
  readonly code: AuthErrorCode
  readonly status?: number

  constructor(code: AuthErrorCode, options: AuthProtocolErrorOptions = {}) {
    super(code)
    this.name = 'AuthProtocolError'
    this.code = code
    this.status = options.status
  }
}
