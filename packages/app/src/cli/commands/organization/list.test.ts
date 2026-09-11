import OrganizationList from './list.js'
import {writeOrganizationListResult} from '../../services/organization/list/result.js'
import {organizationList} from '../../services/organization/list.js'
import {organizationListJsonOutputSchema} from '../../services/organization/list/types.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/organization/list.js')
vi.mock('../../services/organization/list/result.js')

describe('organization list command', () => {
  test('renders text results by default', async () => {
    const result = {organizations: []}
    vi.mocked(organizationList).mockResolvedValue(result)

    await OrganizationList.run([], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith()
    expect(writeOrganizationListResult).toHaveBeenCalledWith(result, 'text')
  })

  test('renders JSON results when --json flag is passed', async () => {
    const result = {organizations: []}
    vi.mocked(organizationList).mockResolvedValue(result)

    await OrganizationList.run(['--json'], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith()
    expect(writeOrganizationListResult).toHaveBeenCalledWith(result, 'json')
  })

  test('renders JSON results when -j flag is passed', async () => {
    const result = {organizations: []}
    vi.mocked(organizationList).mockResolvedValue(result)

    await OrganizationList.run(['-j'], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith()
    expect(writeOrganizationListResult).toHaveBeenCalledWith(result, 'json')
  })

  test('renders an empty JSON result when NoOrgError is thrown', async () => {
    vi.mocked(organizationList).mockRejectedValue(new NoOrgError({type: 'UserAccount', email: 'test@example.com'}))

    await OrganizationList.run(['--json'], import.meta.url)

    expect(writeOrganizationListResult).toHaveBeenCalledWith({organizations: []}, 'json')
  })

  test('passes NoOrgError to the shared error handler in text mode', async () => {
    const error = new NoOrgError({type: 'UserAccount', email: 'test@example.com'})
    vi.mocked(organizationList).mockRejectedValue(error)
    const catchError = vi.spyOn(OrganizationList.prototype, 'catch').mockRejectedValue(error)

    await expect(OrganizationList.run([], import.meta.url)).rejects.toThrow(error)

    expect(catchError).toHaveBeenCalledWith(error)
    expect(writeOrganizationListResult).not.toHaveBeenCalled()
  })

  test('passes other errors to the shared error handler', async () => {
    const error = new Error('request failed')
    vi.mocked(organizationList).mockRejectedValue(error)
    const catchError = vi.spyOn(OrganizationList.prototype, 'catch').mockRejectedValue(error)

    await expect(OrganizationList.run(['--json'], import.meta.url)).rejects.toThrow(error)

    expect(catchError).toHaveBeenCalledWith(error)
    expect(writeOrganizationListResult).not.toHaveBeenCalled()
  })

  test('defines the JSON schema and flag', () => {
    expect(OrganizationList.flags.json).toBeDefined()
    expect(OrganizationList.jsonOutputSchema).toBe(organizationListJsonOutputSchema)
  })
})
