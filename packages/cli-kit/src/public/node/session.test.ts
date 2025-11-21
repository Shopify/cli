import {
  ensureAuthenticatedAdmin,
  ensureAuthenticatedAdminAsApp,
  ensureAuthenticatedAppManagementAndBusinessPlatform,
  ensureAuthenticatedBusinessPlatform,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
  ensureAuthenticatedThemes,
} from './session.js'

import {getPartnersToken} from './environment.js'
import {shopifyFetch} from './http.js'
import {ApplicationToken} from '../../private/node/session/schema.js'
import {ensureAuthenticated, setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../../private/node/session.js'
import {
  exchangeCustomPartnerToken,
  exchangeCliTokenForAppManagementAccessToken,
  exchangeCliTokenForBusinessPlatformAccessToken,
} from '../../private/node/session/exchange.js'
import {vi, describe, expect, test} from 'vitest'

const futureDate = new Date(2022, 1, 1, 11)

const partnersToken: ApplicationToken = {
  accessToken: 'custom_partners_token',
  expiresAt: futureDate,
  scopes: ['scope2'],
}

vi.mock('../../private/node/session.js')
vi.mock('../../private/node/session/exchange.js')
vi.mock('../../private/node/session/store.js')
vi.mock('./environment.js')
vi.mock('./http.js')

describe('ensureAuthenticatedStorefront', () => {
  test('returns only storefront token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({storefront: 'storefront_token', userId: '1234-5678'})

    // When
    const got = await ensureAuthenticatedStorefront()

    // Then
    expect(got).toEqual('storefront_token')
    expect(setLastSeenAuthMethod).not.toBeCalled()
    expect(setLastSeenUserIdAfterAuth).not.toBeCalled()
  })

  test('returns the password if provided, and auth method is custom_app_token', async () => {
    // Given/When
    const got = await ensureAuthenticatedStorefront([], 'theme_access_password')

    // Then
    expect(got).toEqual('theme_access_password')
    expect(setLastSeenAuthMethod).toBeCalledWith('custom_app_token')
    expect(setLastSeenUserIdAfterAuth).toBeCalledWith('dd5e7850-e2de-d283-9c5f-79c8190a19d18b52e0ce')
  })

  test('returns the password if provided, and auth method is theme_access_token', async () => {
    // Given/When
    const got = await ensureAuthenticatedStorefront([], 'shptka_theme_access_password')

    // Then
    expect(got).toEqual('shptka_theme_access_password')
    expect(setLastSeenAuthMethod).toBeCalledWith('theme_access_token')
    expect(setLastSeenUserIdAfterAuth).toBeCalledWith('730a64df-ab2c-3d92-8b11-76a66aadee947aa5c1ce')
  })

  test('throws error if there is no storefront token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token', userId: '1234-5678'})

    // When
    const got = ensureAuthenticatedStorefront()

    // Then
    await expect(got).rejects.toThrow(`No storefront token`)
  })
})

describe('ensureAuthenticatedAdmin', () => {
  test('returns only admin token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
      userId: '1234-5678',
    })

    // When
    const got = await ensureAuthenticatedAdmin('mystore')

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
  })

  test('throws error if there is no token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token', userId: '1234-5678'})

    // When
    const got = ensureAuthenticatedAdmin('mystore')

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })
})

describe('ensureAuthenticatedPartners', () => {
  test('returns only partners token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token', userId: '1234-5678'})

    // When
    const got = await ensureAuthenticatedPartners()

    // Then
    expect(got).toEqual({token: 'partners_token', userId: '1234-5678'})
  })

  test('throws error if there is no partners token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({userId: '1234-5678'})

    // When
    const got = ensureAuthenticatedPartners()

    // Then
    await expect(got).rejects.toThrow(`No partners token`)
  })

  test('returns custom partners token if envvar is defined', async () => {
    // Given
    vi.mocked(exchangeCustomPartnerToken).mockResolvedValueOnce({
      accessToken: partnersToken.accessToken,
      userId: '575e2102-cb13-7bea-4631-ce3469eac491cdcba07d',
    })
    vi.mocked(getPartnersToken).mockReturnValue('custom_cli_token')

    // When
    const got = await ensureAuthenticatedPartners([])

    // Then
    expect(got).toEqual({token: 'custom_partners_token', userId: '575e2102-cb13-7bea-4631-ce3469eac491cdcba07d'})
    expect(ensureAuthenticated).not.toHaveBeenCalled()
  })
})

describe('ensureAuthenticatedTheme', () => {
  test('returns admin token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
      userId: '1234-5678',
    })

    // When
    const got = await ensureAuthenticatedThemes('mystore', undefined)

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
    expect(setLastSeenAuthMethod).not.toBeCalled()
    expect(setLastSeenUserIdAfterAuth).not.toBeCalled()
  })

  test('throws error if there is no token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({userId: ''})

    // When
    const got = ensureAuthenticatedThemes('mystore', undefined)

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })

  test('returns the password when is provided and custom_app_token', async () => {
    // When
    const got = await ensureAuthenticatedThemes('mystore.myshopify.com', 'password')

    // Then
    expect(got).toEqual({token: 'password', storeFqdn: 'mystore.myshopify.com'})
    expect(setLastSeenAuthMethod).toBeCalledWith('custom_app_token')
    expect(setLastSeenUserIdAfterAuth).toBeCalledWith('f5c7086f-320b-3b93-bcdc-a2296adbec02d71eb733')
  })

  test('returns the password when is provided and theme_access_token', async () => {
    // When
    const got = await ensureAuthenticatedThemes('mystore.myshopify.com', 'shptka_password')

    // Then
    expect(got).toEqual({token: 'shptka_password', storeFqdn: 'mystore.myshopify.com'})
    expect(setLastSeenAuthMethod).toBeCalledWith('theme_access_token')
    expect(setLastSeenUserIdAfterAuth).toBeCalledWith('e3d08cca-4e68-504a-00ec-23e2cea12a6340bb257b')
  })
})

describe('ensureAuthenticatedBusinessPlatform', () => {
  test('returns only business-platform token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({businessPlatform: 'business_platform', userId: '1234-5678'})

    // When
    const got = await ensureAuthenticatedBusinessPlatform()

    // Then
    expect(got).toEqual('business_platform')
  })

  test('throws error if there is no business_platform token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token', userId: '1234-5678'})

    // When
    const got = ensureAuthenticatedBusinessPlatform()

    // Then
    await expect(got).rejects.toThrow(`No business-platform token`)
  })
})

describe('ensureAuthenticatedAppManagementAndBusinessPlatform', () => {
  test('returns app management and business platform tokens if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      appManagement: 'app_management_token',
      businessPlatform: 'business_platform_token',
      userId: '1234-5678',
    })

    // When
    const got = await ensureAuthenticatedAppManagementAndBusinessPlatform()

    // Then
    expect(got).toEqual({
      appManagementToken: 'app_management_token',
      businessPlatformToken: 'business_platform_token',
      userId: '1234-5678',
    })
  })

  test('throws error if there are no tokens', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({userId: '1234-5678'})

    // When
    const got = ensureAuthenticatedAppManagementAndBusinessPlatform()

    // Then
    await expect(got).rejects.toThrow('No App Management or Business Platform token found after ensuring authenticated')
  })

  test('returns app managment and business platform tokens if CLI token envvar is defined', async () => {
    // Given
    vi.mocked(getPartnersToken).mockReturnValue('custom_cli_token')
    vi.mocked(exchangeCliTokenForAppManagementAccessToken).mockResolvedValueOnce({
      accessToken: 'app-management-token',
      userId: '575e2102-cb13-7bea-4631-ce3469eac491cdcba07d',
    })
    vi.mocked(exchangeCliTokenForBusinessPlatformAccessToken).mockResolvedValueOnce({
      accessToken: 'business-platform-token',
      userId: '575e2102-cb13-7bea-4631-ce3469eac491cdcba07d',
    })

    // When
    const got = await ensureAuthenticatedAppManagementAndBusinessPlatform()

    // Then
    expect(got).toEqual({
      appManagementToken: 'app-management-token',
      userId: '575e2102-cb13-7bea-4631-ce3469eac491cdcba07d',
      businessPlatformToken: 'business-platform-token',
    })
    expect(ensureAuthenticated).not.toHaveBeenCalled()
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
