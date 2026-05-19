import {selectOrg} from './select.js'
import {fetchOrganizations} from './fetch.js'
import {selectOrganizationPrompt} from '../prompts/organization.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./fetch.js')
vi.mock('../prompts/organization.js')

const ORGS = [
  {id: '1234', businessName: 'My Org'},
  {id: '5678', businessName: 'Other Org'},
]

describe('selectOrg', () => {
  test('returns org matching flag ID', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)

    const result = await selectOrg('5678')

    expect(result).toEqual({id: '5678', businessName: 'Other Org'})
    expect(selectOrganizationPrompt).not.toHaveBeenCalled()
  })

  test('throws AbortError when flag ID does not match any org', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)

    await expect(selectOrg('9999')).rejects.toThrow('Organization with ID 9999 not found.')
  })

  test('falls back to prompt when no flag is provided', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORGS[0]!)

    const result = await selectOrg()

    expect(result).toEqual({id: '1234', businessName: 'My Org'})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith(ORGS)
  })

  test('falls back to prompt when flag is undefined', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORGS[1]!)

    const result = await selectOrg(undefined)

    expect(result).toEqual({id: '5678', businessName: 'Other Org'})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith(ORGS)
  })

  test('throws AbortError when no organizations are found', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([])

    await expect(selectOrg()).rejects.toThrow('No organizations found.')
  })
})
