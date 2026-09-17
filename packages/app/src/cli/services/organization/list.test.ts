import {organizationList} from './list.js'
import {organizationListJsonOutputSchema} from './list/types.js'
import {fetchOrganizations, NoOrgError} from '../dev/fetch.js'
import {OrganizationSource, OrganizationWithDetails} from '../../models/organization.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../dev/fetch.js')

const ORG1: OrganizationWithDetails = {
  id: '123',
  businessName: 'Test Organization',
  source: OrganizationSource.Partners,
  status: 'ACTIVE',
  shopCount: 3,
  url: 'https://admin.shopify.com/organization/123',
}

const ORG2: OrganizationWithDetails = {
  id: '456',
  businessName: 'Another Organization',
  source: OrganizationSource.BusinessPlatform,
  status: 'LOCKED',
  shopCount: null,
  url: 'https://admin.shopify.com/organization/456',
}

describe('organizationList', () => {
  test('returns organizations with id, gid, name, status, shop count, and url (excludes source)', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])

    const result = await organizationList()

    expect(result).toEqual({
      organizations: [
        {
          id: '123',
          gid: 'gid://organization/Organization/123',
          name: 'Test Organization',
          status: 'ACTIVE',
          shopCount: 3,
          url: 'https://admin.shopify.com/organization/123',
        },
        {
          id: '456',
          gid: 'gid://organization/Organization/456',
          name: 'Another Organization',
          status: 'LOCKED',
          shopCount: null,
          url: 'https://admin.shopify.com/organization/456',
        },
      ],
    })
  })

  test('propagates NoOrgError', async () => {
    const error = new NoOrgError({type: 'UserAccount', email: 'test@example.com'})
    vi.mocked(fetchOrganizations).mockRejectedValue(error)

    await expect(organizationList()).rejects.toThrow(error)
  })
})

describe('organizationListJsonOutputSchema', () => {
  test('encodes the public result in a stable field order', () => {
    expect(
      organizationListJsonOutputSchema.encode({
        organizations: [
          {
            id: '123',
            gid: 'gid://organization/Organization/123',
            name: 'Test Organization',
            status: 'ACTIVE',
            shopCount: null,
            url: 'https://admin.shopify.com/organization/123',
          },
        ],
      }),
    ).toBe(`{
  "organizations": [
    {
      "id": "123",
      "gid": "gid://organization/Organization/123",
      "name": "Test Organization",
      "status": "ACTIVE",
      "shopCount": null,
      "url": "https://admin.shopify.com/organization/123"
    }
  ]
}`)
  })

  test('rejects an unknown status value', () => {
    expect(() =>
      organizationListJsonOutputSchema.validate({
        organizations: [
          {
            id: '123',
            gid: 'gid://organization/Organization/123',
            name: 'Test Organization',
            status: 'SUSPENDED',
            shopCount: 3,
            url: 'https://admin.shopify.com/organization/123',
          },
        ],
      }),
    ).toThrow()
  })

  test('rejects invalid public results', () => {
    expect(() => organizationListJsonOutputSchema.validate({organizations: [{id: 123}]})).toThrow()
  })
})
