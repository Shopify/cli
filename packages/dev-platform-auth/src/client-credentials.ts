import type {
  ClientCredentialsConfig,
  ClientCredentialsToken,
  ClientCredentialsClient,
  ClientCredentialsError,
  ClientCredentialsTokenRequest,
} from './index.js'

export function createClientCredentialsClient(config: ClientCredentialsConfig): ClientCredentialsClient {
  return {
    requestToken: async (request) => requestClientCredentialsToken(config, request),
  }
}

export async function requestClientCredentialsToken(
  config: ClientCredentialsConfig,
  request: ClientCredentialsTokenRequest,
): Promise<ClientCredentialsToken | ClientCredentialsError> {
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
  } catch {
    // The fetch port reports all request failures as typed transport errors.
    return {kind: 'transport_failed', cause: new Error('Auth request failed')}
  }

  let body: string
  try {
    body = await response.text()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return {kind: 'transport_failed', cause: new Error('Auth response could not be read')}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    const serverCode = response.status === 400 && body.includes('app_not_installed') ? 'app_not_installed' : undefined
    if (serverCode) return {serverCode, status: response.status}
    return {kind: 'malformed_response', status: response.status, cause: new Error('Auth response is not valid JSON')}
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
    storeFqdn: request.storeFqdn,
  }
}

function readServerCode(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if ('error' in value && typeof value.error === 'string' && value.error.length > 0) return value.error
  return 'unknown_error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
