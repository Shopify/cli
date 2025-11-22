import {IdentityToken, Session} from './schema.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {outputDebug, outputContent, outputToken} from '../../../public/node/output.js'
import {isLocalEnvironment} from '../context/service.js'
import {assertConnectable} from '../../../public/node/vendor/dev_server/network/index.js'
import {developerDashboardFqdn} from '../../../public/node/context/fqdn.js'

interface MockUserResponse {
  uuid: string
  expires_at: string
  id_token: string
  access_token: string
  refresh_token: string
  last_login: string
  scope: string
  userinfo: {
    email: string
    email_verified: boolean
    given_name: string
    family_name: string
    name: string
    picture: string
    zoneinfo: string
    locale: string
    permissions: string[]
    okta_id: string | null
    updated_at: string
    created_at: string
  }
}

export function shouldUseMockAuth(): boolean {
  if (!isLocalEnvironment()) {
    return false
  }

  try {
    assertConnectable({
      projectName: 'identity',
      addr: '127.0.0.1',
      port: 8080,
      timeout: 100,
    })
    return false
  } catch (e) {
    outputDebug(outputContent`Identity service is not running. Using mock authentication.`)
    throw e
    return true
  }
}

export async function fetchMockUser(scopes: string[]): Promise<MockUserResponse> {
  const devDashboardFqdn = await developerDashboardFqdn()
  const scopeParam = scopes.join(' ')
  const nonce = Math.random().toString(36).substring(2)
  const state = Math.random().toString(36).substring(2)

  const params = new URLSearchParams({
    'config-key': 'cli',
    scope: scopeParam,
    nonce,
    state,
    'created-at': Date.now().toString(),
  })

  const url = `https://${devDashboardFqdn}/identity/test-login?${params.toString()}`

  outputDebug(outputContent`Fetching mock user from: ${url}`)

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    outputDebug(outputContent`Failed response: ${text.substring(0, 500)}`)
    throw new Error(`Failed to fetch mock user: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as MockUserResponse
  outputDebug(outputContent`Mock user fetched: ${outputToken.json(data)}`)

  return data
}

export function buildMockIdentityToken(mockUser: MockUserResponse, scopes: string[]): IdentityToken {
  const expiresAt = new Date(mockUser.expires_at)

  return {
    accessToken: mockUser.access_token,
    refreshToken: mockUser.refresh_token,
    expiresAt,
    scopes,
    userId: mockUser.uuid,
  }
}

export function buildMockSession(mockUser: MockUserResponse, scopes: string[]): Session {
  const identityToken = buildMockIdentityToken(mockUser, scopes)

  return {
    identity: {
      ...identityToken,
      alias: mockUser.userinfo.email,
    },
    applications: {},
  }
}
