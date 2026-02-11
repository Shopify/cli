import {getToken, getUserId, getAuthMethod, ensureAuthenticatedAdminAsApp} from './session.js'

import {shopifyFetch} from './http.js'
import {createDefaultCredentialProvider} from './api/auth/credential-provider.js'
import {getLastSeenUserIdAfterAuth, getLastSeenAuthMethod} from '../../private/node/session.js'
import {vi, describe, expect, test} from 'vitest'

vi.mock('./api/auth/credential-provider.js')
vi.mock('../../private/node/session.js')
vi.mock('../../private/node/session/store.js')
vi.mock('./http.js')

describe('getToken', () => {
  test('returns the token from the credential provider chain', async () => {
    // Given
    const mockProvider = {name: 'mock', getToken: vi.fn().mockResolvedValue('partners_token')}
    vi.mocked(createDefaultCredentialProvider).mockReturnValue(mockProvider)

    // When
    const got = await getToken('partners')

    // Then
    expect(got).toBe('partners_token')
    expect(mockProvider.getToken).toHaveBeenCalledWith('partners', undefined)
  })

  test('passes context to the credential provider', async () => {
    // Given
    const mockProvider = {name: 'mock', getToken: vi.fn().mockResolvedValue('admin_token')}
    vi.mocked(createDefaultCredentialProvider).mockReturnValue(mockProvider)

    // When
    const got = await getToken('admin', {storeFqdn: 'mystore.myshopify.com', password: 'shptka_xxx'})

    // Then
    expect(got).toBe('admin_token')
    expect(mockProvider.getToken).toHaveBeenCalledWith('admin', {
      storeFqdn: 'mystore.myshopify.com',
      password: 'shptka_xxx',
    })
  })

  test('throws BugError if no token is returned', async () => {
    // Given
    const mockProvider = {name: 'mock', getToken: vi.fn().mockResolvedValue(null)}
    vi.mocked(createDefaultCredentialProvider).mockReturnValue(mockProvider)

    // When/Then
    await expect(getToken('partners')).rejects.toThrow('No partners token obtained from credential provider chain')
  })

  test('passes forceRefresh and noPrompt in context', async () => {
    // Given
    const mockProvider = {name: 'mock', getToken: vi.fn().mockResolvedValue('token')}
    vi.mocked(createDefaultCredentialProvider).mockReturnValue(mockProvider)

    // When
    await getToken('partners', {forceRefresh: true, noPrompt: true})

    // Then
    expect(mockProvider.getToken).toHaveBeenCalledWith('partners', {forceRefresh: true, noPrompt: true})
  })

  test('passes forceNewSession in context', async () => {
    // Given
    const mockProvider = {name: 'mock', getToken: vi.fn().mockResolvedValue('token')}
    vi.mocked(createDefaultCredentialProvider).mockReturnValue(mockProvider)

    // When
    await getToken('partners', {forceNewSession: true})

    // Then
    expect(mockProvider.getToken).toHaveBeenCalledWith('partners', {forceNewSession: true})
  })
})

describe('getUserId', () => {
  test('delegates to getLastSeenUserIdAfterAuth', async () => {
    // Given
    vi.mocked(getLastSeenUserIdAfterAuth).mockResolvedValue('user-123')

    // When
    const got = await getUserId()

    // Then
    expect(got).toBe('user-123')
  })
})

describe('getAuthMethod', () => {
  test('delegates to getLastSeenAuthMethod', async () => {
    // Given
    vi.mocked(getLastSeenAuthMethod).mockResolvedValue('device_auth')

    // When
    const got = await getAuthMethod()

    // Then
    expect(got).toBe('device_auth')
  })
})

describe('ensureAuthenticatedAdminAsApp', () => {
  test('returns admin token if success', async () => {
    // Given
    vi.mocked(shopifyFetch).mockResolvedValueOnce({
      status: 200,
      json: async () => ({access_token: 'app_access_token'}),
    } as any)

    // When
    const got = await ensureAuthenticatedAdminAsApp('mystore.myshopify.com', 'client123', 'secret456')

    // Then
    expect(got).toEqual({token: 'app_access_token', storeFqdn: 'mystore.myshopify.com'})
  })

  test('throws error if app is not installed', async () => {
    // Given
    vi.mocked(shopifyFetch).mockResolvedValueOnce({
      status: 400,
      text: async () => 'error: app_not_installed',
    } as any)

    // When
    const got = ensureAuthenticatedAdminAsApp('mystore.myshopify.com', 'client123', 'secret456')

    // Then
    await expect(got).rejects.toThrow(/App is not installed/)
  })

  test('throws error on other 400 errors', async () => {
    // Given
    vi.mocked(shopifyFetch).mockResolvedValueOnce({
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'invalid credentials',
    } as any)

    // When
    const got = ensureAuthenticatedAdminAsApp('mystore.myshopify.com', 'client123', 'secret456')

    // Then
    await expect(got).rejects.toThrow('Failed to get access token for app client123 on store mystore.myshopify.com')
  })
})
