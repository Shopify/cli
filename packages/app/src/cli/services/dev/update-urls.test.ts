import {updateURLs} from './update-urls'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'
import {outputMocker} from '@shopify/cli-testing'

beforeEach(() => {
  vi.mock('$cli/prompts/dev')
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
    }
  })
})

describe('updateURLs', () => {
  it('sends a request to update the URLs', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const expectedVariables = {
      apiKey: 'apiKey',
      appUrl: 'http://localhost:3456',
      redir: [
        'http://localhost:3456/auth/callback',
        'http://localhost:3456/auth/shopify/callback',
        'http://localhost:3456/api/auth/callback',
      ],
    }

    // When
    await updateURLs('apiKey', 'http://localhost:3456')

    // Then
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.UpdateURLsQuery, 'token', expectedVariables)
  })

  it('notifies the user about the update', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const outputMock = outputMocker.mockAndCapture()

    // When
    await updateURLs('apiKey', 'http://localhost:3456')

    // Then
    expect(outputMock.output()).toMatch('Allowed redirection URLs updated in Partners Dashboard')
  })

  it('throws an error if requests has a user error', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: [{message: 'Boom!'}]}})

    // When
    const got = updateURLs('apiKey', 'http://localhost:3456')

    // Then
    expect(got).rejects.toThrow(`Boom!`)
  })
})
