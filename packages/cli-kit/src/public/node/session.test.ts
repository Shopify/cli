import {
  ensureAuthenticatedAdmin,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
  ensureAuthenticatedThemes,
} from './session.js'

import {ApplicationToken} from '../../private/node/session/schema.js'
import {ensureAuthenticated} from '../../private/node/session.js'
import {exchangeCustomPartnerToken} from '../../private/node/session/exchange.js'
import {vi, describe, expect, it, beforeAll} from 'vitest'

const futureDate = new Date(2022, 1, 1, 11)

const partnersToken: ApplicationToken = {
  accessToken: 'custom_partners_token',
  expiresAt: futureDate,
  scopes: ['scope2'],
}

beforeAll(() => {
  vi.mock('../../private/node/session.js')
  vi.mock('../../private/node/session/exchange.js')
  vi.mock('../../private/node/session/store.js')
})

describe('ensureAuthenticatedStorefront', () => {
  it('returns only storefront token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({storefront: 'storefront_token'})

    // When
    const got = await ensureAuthenticatedStorefront()

    // Then
    expect(got).toEqual('storefront_token')
  })

  it('returns the password if provided', async () => {
    // Given/When
    const got = await ensureAuthenticatedStorefront([], 'theme_access_password')

    // Then
    expect(got).toEqual('theme_access_password')
  })

  it('throws error if there is no storefront token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = ensureAuthenticatedStorefront()

    // Then
    await expect(got).rejects.toThrow(`No storefront token`)
  })
})

describe('ensureAuthenticatedAdmin', () => {
  it('returns only admin token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
    })

    // When
    const got = await ensureAuthenticatedAdmin('mystore')

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
  })

  it('throws error if there is no token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = ensureAuthenticatedAdmin('mystore')

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })
})

describe('ensureAuthenticatedPartners', () => {
  it('returns only partners token if success', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})

    // When
    const got = await ensureAuthenticatedPartners()

    // Then
    expect(got).toEqual('partners_token')
  })

  it('throws error if there is no partners token', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({})

    // When
    const got = ensureAuthenticatedPartners()

    // Then
    await expect(got).rejects.toThrow(`No partners token`)
  })

  it('returns custom partners token if envvar is defined', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({partners: 'partners_token'})
    vi.mocked(exchangeCustomPartnerToken).mockResolvedValueOnce(partnersToken)
    const env = {SHOPIFY_CLI_PARTNERS_TOKEN: 'custom_cli_token'}

    // When
    const got = await ensureAuthenticatedPartners([], env)

    // Then
    expect(got).toEqual('custom_partners_token')
  })
})

describe('ensureAuthenticatedTheme', () => {
  it('returns admin token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({
      admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
    })

    // When
    const got = await ensureAuthenticatedThemes('mystore', undefined)

    // Then
    expect(got).toEqual({token: 'admin_token', storeFqdn: 'mystore.myshopify.com'})
  })

  it('throws error if there is no token when no password is provided', async () => {
    // Given
    vi.mocked(ensureAuthenticated).mockResolvedValueOnce({})

    // When
    const got = ensureAuthenticatedThemes('mystore', undefined)

    // Then
    await expect(got).rejects.toThrow(`No admin token`)
  })

  it('returns the password when is provided', async () => {
    // When
    const got = await ensureAuthenticatedThemes('mystore', 'password')

    // Then
    expect(got).toEqual({token: 'password', storeFqdn: 'mystore.myshopify.com'})
  })
})
