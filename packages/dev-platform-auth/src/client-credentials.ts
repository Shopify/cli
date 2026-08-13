import type {
  ApplicationToken,
  AuthClientConfig,
  ClientCredentialsClient,
  ClientCredentialsError,
  ClientCredentialsTokenRequest,
} from './index.js'

const TOKEN_LIFETIME_MS = 300_000

export function createClientCredentialsClient(config: AuthClientConfig): ClientCredentialsClient {
  return {
    requestToken: async (request) => requestClientCredentialsToken(config, request),
  }
}

export async function requestClientCredentialsToken(
  config: AuthClientConfig,
  request: ClientCredentialsTokenRequest,
): Promise<ApplicationToken | ClientCredentialsError> {
  if (!config.fetch) {
    return {kind: 'transport_failed', cause: new Error('Auth fetch is not configured')}
  }

  let response
  try {
    response = await config.fetch(`https://${request.storeFqdn}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: request.clientId,
        client_secret: request.clientSecret,
        grant_type: 'client_credentials',
      }),
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (cause) {
    // The fetch port reports all request failures as typed transport errors.
    return {kind: 'transport_failed', cause}
  }

  let body: string
  try {
    body = await response.text()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (cause) {
    return {kind: 'transport_failed', cause}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (cause) {
    const serverCode = body.includes('app_not_installed') ? 'app_not_installed' : undefined
    if (serverCode) return {serverCode, status: response.status}
    return response.ok
      ? {kind: 'malformed_response', status: response.status, cause}
      : {kind: 'unexpected_status', status: response.status}
  }

  if (!response.ok) {
    const serverCode = readServerCode(parsed)
    return serverCode ? {serverCode, status: response.status} : {kind: 'unexpected_status', status: response.status}
  }

  if (!isRecord(parsed) || typeof parsed.access_token !== 'string' || parsed.access_token.length === 0) {
    return {kind: 'malformed_response', status: response.status}
  }

  return {
    accessToken: parsed.access_token,
    expiresAt: (config.clock?.now() ?? 0) + TOKEN_LIFETIME_MS,
    scopes: [],
    storeFqdn: request.storeFqdn,
  }
}

function readServerCode(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if ('error' in value && typeof value.error === 'string' && value.error.length > 0) return value.error
  if ('error' in value) return 'unknown_error'
  return 'unknown_error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
