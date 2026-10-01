import {fetchDestinationsContext} from './destinations.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const SHOP = 'shop.myshopify.com'

function destinationNode(overrides: Record<string, unknown> = {}) {
  return {
    publicId: 'dest-public-1',
    primaryDomain: `https://${SHOP}`,
    webUrl: `https://${SHOP}/admin`,
    ...overrides,
  }
}

describe('fetchDestinationsContext', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  })

  test('throws AbortError when no destination matches the domain', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {destinations: {nodes: []}},
    })

    const err = await fetchDestinationsContext({store: SHOP}).catch((error: unknown) => error)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain(SHOP)
  })

  test('throws AbortError when domain match is missing from results', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {
        destinations: {
          nodes: [
            destinationNode({
              primaryDomain: 'https://other.myshopify.com',
              webUrl: 'https://other.myshopify.com/admin',
            }),
          ],
        },
      },
    })

    const err = await fetchDestinationsContext({store: SHOP}).catch((error: unknown) => error)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain(SHOP)
  })

  test('searches BP with the subdomain rather than the full FQDN', async () => {
    vi.mocked(businessPlatformRequestDoc)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      })
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: {id: 'gid', name: 'Org'}},
      })

    await fetchDestinationsContext({store: SHOP})

    expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0].variables).toEqual({search: 'shop'})
  })

  test('extracts the subdomain handle for non-myshopify FQDNs (local dev)', async () => {
    const devStore = 'my-dev-store.shop.dev'
    vi.mocked(businessPlatformRequestDoc)
      .mockResolvedValueOnce({
        currentUserAccount: {
          destinations: {
            nodes: [destinationNode({primaryDomain: `https://${devStore}`, webUrl: `https://${devStore}/admin`})],
          },
        },
      })
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: {id: 'gid', name: 'Org'}},
      })

    await fetchDestinationsContext({store: devStore})

    expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0].variables).toEqual({search: 'my-dev-store'})
  })

  test('resolves the owning org via the matched destination publicId', async () => {
    vi.mocked(businessPlatformRequestDoc)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      })
      .mockResolvedValueOnce({
        currentUserAccount: {
          organizationForDestination: {
            id: Buffer.from('gid://organization/Organization/123').toString('base64'),
            name: 'Acme Org',
          },
        },
      })

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(vi.mocked(businessPlatformRequestDoc).mock.calls[1]?.[0].variables).toEqual({
      destinationPublicId: 'dest-public-1',
    })
    expect(ctx.owningOrg).toEqual({name: 'Acme Org', id: '123'})
  })

  test('leaves owning org undefined when the org request throws', async () => {
    vi.mocked(businessPlatformRequestDoc)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      })
      .mockRejectedValueOnce(new Error('boom'))

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.owningOrg).toBeUndefined()
  })

  test('leaves owning org undefined when the org is missing from the response', async () => {
    vi.mocked(businessPlatformRequestDoc)
      .mockResolvedValueOnce({
        currentUserAccount: {destinations: {nodes: [destinationNode()]}},
      })
      .mockResolvedValueOnce({
        currentUserAccount: {organizationForDestination: null},
      })

    const ctx = await fetchDestinationsContext({store: SHOP})

    expect(ctx.owningOrg).toBeUndefined()
  })

  test('uses a provided token without re-authenticating', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {destinations: {nodes: [destinationNode()]}},
    })
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {organizationForDestination: {id: 'gid', name: 'O'}},
    })

    await fetchDestinationsContext({store: SHOP, token: 'preset'})

    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0].token).toBe('preset')
  })

  test('passes noPrompt through when authenticating', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {destinations: {nodes: [destinationNode()]}},
    })
    vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({
      currentUserAccount: {organizationForDestination: {id: 'gid', name: 'O'}},
    })

    await fetchDestinationsContext({store: SHOP, noPrompt: true})

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: true, allowAutomationToken: true})
  })
})
