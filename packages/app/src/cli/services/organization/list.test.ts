import {organizationList} from './list.js'
import {fetchOrganizations, NoOrgError} from '../dev/fetch.js'
import {Organization, OrganizationSource} from '../../models/organization.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

vi.mock('../dev/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')

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
  test('renders table with organization id and name', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])

    await organizationList({json: false})

    expect(renderTable).toHaveBeenCalledWith({
      rows: [
        {id: '123', name: 'Test Organization'},
        {id: '456', name: 'Another Organization'},
      ],
      columns: {
        id: {header: 'ID'},
        name: {header: 'NAME'},
      },
    })
  })

  test('outputs JSON with id, gid, and name (excludes source)', async () => {
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])

    await organizationList({json: true})

    expect(JSON.parse(mockOutput.output())).toEqual({
      organizations: [
        {id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'},
        {id: '456', gid: 'gid://organization/Organization/456', name: 'Another Organization'},
      ],
    })
  })

  test('returns empty JSON array when NoOrgError thrown in JSON mode', async () => {
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    const error = new NoOrgError({type: 'UserAccount', email: 'test@example.com'})
    vi.mocked(fetchOrganizations).mockRejectedValue(error)

    await organizationList({json: true})

    expect(JSON.parse(mockOutput.output())).toEqual({organizations: []})
  })

  test('propagates NoOrgError in table mode', async () => {
    const error = new NoOrgError({type: 'UserAccount', email: 'test@example.com'})
    vi.mocked(fetchOrganizations).mockRejectedValue(error)

    await expect(organizationList({json: false})).rejects.toThrow(NoOrgError)
  })
})
