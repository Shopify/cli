import {
  ensureAuthenticatedAdmin,
  ensureAuthenticatedBusinessPlatform,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
  ensureAuthenticatedThemes,
} from './session.js'

import {getPartnersToken} from './environment.js'
import {ApplicationToken} from '../../private/node/session/schema.js'
import {ensureAuthenticated} from '../../private/node/session.js'
import {exchangeCustomPartnerToken} from '../../private/node/session/exchange.js'
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

describe('ensureAuthenticatedStorefront', () => {
  test('returns only storefront token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({storefront: 'storefront_token'})

    // When
    const got = await ensureAuthenticatedStorefront()

    // Then
    expect(got).toEqual('storefront_token')
  })

  test('returns the password if provided', async () => {
    // Given/When
    const got = await ensureAuthenticatedStorefront([], 'theme_access_password')

    // Then
    expect(got).toEqual('theme_access_password')
  })

  test('throws error if there is no storefront token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

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
    })

    // When
    const got = await ensureAuthenticatedAdmin('mystore')

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
  })

  test('throws error if there is no token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = ensureAuthenticatedAdmin('mystore')

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })
})

describe('ensureAuthenticatedPartners', () => {
  test('returns only partners token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = await ensureAuthenticatedPartners()

    // Then
    expect(got).toEqual('partners_token')
  })

  test('throws error if there is no partners token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({})

    // When
    const got = ensureAuthenticatedPartners()

    // Then
    await expect(got).rejects.toThrow(`No partners token`)
  })

  test('returns custom partners token if envvar is defined', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})
    vi.mocked(exchangeCustomPartnerToken).mockResolvedValueOnce(partnersToken)
    vi.mocked(getPartnersToken).mockReturnValue('custom_cli_token')

    // When
    const got = await ensureAuthenticatedPartners([])

    // Then
    expect(got).toEqual('custom_partners_token')
  })
})

describe('ensureAuthenticatedTheme', () => {
  test('returns admin token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
    })

    // When
    const got = await ensureAuthenticatedThemes('mystore', undefined)

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
  })

  test('throws error if there is no token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({})

    // When
    const got = ensureAuthenticatedThemes('mystore', undefined)

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })

  test('returns the password when is provided', async () => {
    // When
    const got = await ensureAuthenticatedThemes('mystore', 'password')

    // Then
    expect(got).toEqual({token: 'password', storeFqdn: 'mystore.myshopify.com'})
  })
})

describe('ensureAuthenticatedBusinessPlatform', () => {
  test('returns only business-platform token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({businessPlatform: 'business_platform'})

    // When
    const got = await ensureAuthenticatedBusinessPlatform()

    // Then
    expect(got).toEqual('business_platform')
  })

  test('throws error if there is no business_platform token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = ensureAuthenticatedBusinessPlatform()

    // Then
    await expect(got).rejects.toThrow(`No business-platform token`)
  })
})
