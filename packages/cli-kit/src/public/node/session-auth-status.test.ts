import {getAuthStatus} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import {getCurrentSessionId} from '../../private/node/conf-store.js'
import * as sessionStore from '../../private/node/session/store.js'
import {validateSession} from '../../private/node/session/validate.js'
import {Session} from '../../private/node/session/schema.js'

import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./context/fqdn.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('../../private/node/session/store.js')
vi.mock('../../private/node/session/validate.js')

const expiresAt = new Date('2030-01-01T00:00:00.000Z')
const session: Session = {
  identity: {
    accessToken: 'identity-token',
    refreshToken: 'refresh-token',
    expiresAt,
    scopes: ['scope'],
    userId: 'user-id',
    alias: 'user@example.com',
  },
  applications: {},
}

describe('getAuthStatus', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('accounts.shopify.com')
    vi.mocked(getCurrentSessionId).mockReturnValue('user-id')
    vi.mocked(sessionStore.fetch).mockResolvedValue({
      'accounts.shopify.com': {
        'user-id': session,
      },
    })
    vi.mocked(validateSession).mockResolvedValue('ok')
  })

  test('returns authenticated for a valid current session', async () => {
    // When
    const got = await getAuthStatus()

    // Then
    expect(got).toEqual({
      status: 'authenticated',
      authenticated: true,
      account: {
        userId: 'user-id',
        alias: 'user@example.com',
      },
      identityFqdn: 'accounts.shopify.com',
      expiresAt: '2030-01-01T00:00:00.000Z',
      agentGuidance: {
        instruction: 'A Shopify CLI session is available. Continue with the requested Shopify CLI command.',
      },
    })
  })

  test('returns needs_refresh for a refreshable current session', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValue('needs_refresh')

    // When
    const got = await getAuthStatus()

    // Then
    expect(got.status).toBe('needs_refresh')
    expect(got.authenticated).toBe(true)
    expect(got.account?.userId).toBe('user-id')
  })

  test('falls back to the first stored session when no current session is configured', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)

    // When
    const got = await getAuthStatus()

    // Then
    expect(got.status).toBe('authenticated')
    expect(got.account?.userId).toBe('user-id')
  })

  test('returns not_authenticated when no session exists', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)

    // When
    const got = await getAuthStatus()

    // Then
    expect(got).toEqual({
      status: 'not_authenticated',
      authenticated: false,
      identityFqdn: 'accounts.shopify.com',
      agentGuidance: {
        instruction:
          'No usable Shopify CLI session is available. Run `shopify auth login`, show the verification URL and user code to the user, and keep the command running until authentication completes.',
        nextCommand: 'shopify auth login',
      },
    })
  })

  test('returns invalid when the current session id is missing from storage', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue('missing-user-id')

    // When
    const got = await getAuthStatus()

    // Then
    expect(got.status).toBe('invalid')
    expect(got.authenticated).toBe(false)
  })
})
