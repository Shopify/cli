import {updateURLs, generateURL} from './urls.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api, error} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
      plugins: {
        lookupTunnelPlugin: async () => {
          return {start: async () => 'https://fake-url.ngrok.io'}
        },
      },
    }
  })
})

describe('generateURL', () => {
  it('returns a tunnel URL by default', async () => {
    // Given
    const pluginList: Plugin[] = []
    // When

    const got = await generateURL(pluginList, 3456)

    // Then
    expect(got).toEqual('https://fake-url.ngrok.io')
  })
})

describe('updateURLs', () => {
  it('sends a request to update the URLs', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const expectedVariables = {
      apiKey: 'apiKey',
      appUrl: 'https://example.com',
      redir: [
        'https://example.com/auth/callback',
        'https://example.com/auth/shopify/callback',
        'https://example.com/api/auth/callback',
      ],
    }

    // When
    await updateURLs('apiKey', 'https://example.com', 'token')

    // Then
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.UpdateURLsQuery, 'token', expectedVariables)
  })

  it('throws an error if requests has a user error', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: [{message: 'Boom!'}]}})

    // When
    const got = updateURLs('apiKey', 'https://example.com', 'token')

    // Then
    await expect(got).rejects.toThrow(new error.Abort(`Boom!`))
  })
})
