export const PACKAGE_NAME = '@shopify/dev-platform-auth'

export interface ClientCredentialsToken {
  accessToken: string
  storeFqdn: string
}

export interface ClientCredentialsConfig {
  fetch?: AuthFetch
}

export interface AuthFetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

export type AuthFetch = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
  },
) => Promise<AuthFetchResponse>

export interface ClientCredentialsTokenRequest {
  storeFqdn: string
  clientId: string
  clientSecret: string
}

export type ClientCredentialsError =
  | {kind: 'transport_failed'; cause: unknown}
  | {kind: 'malformed_response'; status: number; cause?: unknown}
  | {kind: 'unexpected_status'; status: number}
  | {serverCode: string; status: number}

export type ClientCredentialsResult = ClientCredentialsToken | ClientCredentialsError

export interface ClientCredentialsClient {
  requestToken(options: ClientCredentialsTokenRequest): Promise<ClientCredentialsResult>
}

export {createClientCredentialsClient, requestClientCredentialsToken} from './client-credentials.js'
