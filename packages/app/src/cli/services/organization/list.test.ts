import {organizationList} from './list.js'
import {organizationListJsonOutputSchema} from './list/types.js'
import {fetchOrganizations, NoOrgError} from '../dev/fetch.js'
import {Organization, OrganizationSource} from '../../models/organization.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../dev/fetch.js')

const ORG1: Organization = {
  id: '123',
  businessName: 'Test Organization',
  source: OrganizationSource.Partners,
}

const ORG2: Organization = {
  id: '456',
  businessName: 'Another Organization',
  source: OrganizationSource.BusinessPlatform,
}

describe('organizationList', () => {
  test('returns organizations with id, gid, and name (excludes source)', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])

    const result = await organizationList()

    expect(result).toEqual({
      organizations: [
        {id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'},
        {id: '456', gid: 'gid://organization/Organization/456', name: 'Another Organization'},
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
  test('encodes the public result', () => {
    expect(
      organizationListJsonOutputSchema.encode({
        organizations: [{id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'}],
      }),
    ).toBe(`{
  "organizations": [
    {
      "id": "123",
      "gid": "gid://organization/Organization/123",
      "name": "Test Organization"
    }
  ]
}`)
  })

  test('rejects invalid public results', () => {
    expect(() => organizationListJsonOutputSchema.validate({organizations: [{id: 123}]})).toThrow()
  })
})
