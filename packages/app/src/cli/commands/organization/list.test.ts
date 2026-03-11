import OrganizationList from './list.js'
import {organizationList} from '../../services/organization/list.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/organization/list.js')

describe('organization list command', () => {
  test('calls organizationList service with json: false by default', async () => {
    vi.mocked(organizationList).mockResolvedValue()

    await OrganizationList.run([], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith({json: false})
  })

  test('calls organizationList service with json: true when --json flag is passed', async () => {
    vi.mocked(organizationList).mockResolvedValue()

    await OrganizationList.run(['--json'], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith({json: true})
  })

  test('calls organizationList service with json: true when -j flag is passed', async () => {
    vi.mocked(organizationList).mockResolvedValue()

    await OrganizationList.run(['-j'], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith({json: true})
  })
})
