import {fetchOrganizations} from './fetch.js'
import {describe, expect, test, vi} from 'vitest'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const ENCODED_GID_1 = Buffer.from('gid://organization/Organization/1234').toString('base64')
const ENCODED_GID_2 = Buffer.from('gid://organization/Organization/5678').toString('base64')

describe('fetchOrganizations', () => {
  test('returns organizations with decoded numeric IDs', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        organizationsWithAccessToDestination: {
          nodes: [
            {id: ENCODED_GID_1, name: 'My Org'},
            {id: ENCODED_GID_2, name: 'Other Org'},
          ],
        },
      },
    })

    const orgs = await fetchOrganizations()

    expect(orgs).toEqual([
      {id: '1234', businessName: 'My Org'},
      {id: '5678', businessName: 'Other Org'},
    ])
  })

  test('returns empty array when no currentUserAccount is returned', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: null,
    })

    const orgs = await fetchOrganizations()
    expect(orgs).toEqual([])
  })

  test('returns empty array when organizations list is empty', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        organizationsWithAccessToDestination: {
          nodes: [],
        },
      },
    })

    const orgs = await fetchOrganizations()
    expect(orgs).toEqual([])
  })

  test('passes token and unauthorized handler to businessPlatformRequestDoc', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        organizationsWithAccessToDestination: {
          nodes: [{id: ENCODED_GID_1, name: 'My Org'}],
        },
      },
    })

    await fetchOrganizations()

    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        unauthorizedHandler: expect.objectContaining({
          type: 'token_refresh',
        }),
      }),
    )
  })
})
