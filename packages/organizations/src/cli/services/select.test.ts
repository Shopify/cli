import {selectOrg} from './select.js'
import {fetchOrganizations} from './fetch.js'
import {selectOrganizationPrompt} from '../prompts/organization.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./fetch.js')
vi.mock('../prompts/organization.js')

const ORG_1 = {
  id: '1234',
  businessName: 'My Org',
  status: 'ACTIVE' as const,
  shopCount: 1,
  url: 'https://admin.shopify.com/organization/1234',
}

const ORG_2 = {
  id: '5678',
  businessName: 'Other Org',
  status: 'LOCKED' as const,
  shopCount: null,
  url: 'https://admin.shopify.com/organization/5678',
}

const ORGS = [ORG_1, ORG_2]

describe('selectOrg', () => {
  test('returns org matching flag ID', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)

    const result = await selectOrg('5678')

    expect(result).toEqual(ORG_2)
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

    expect(result).toEqual(ORG_1)
    expect(selectOrganizationPrompt).toHaveBeenCalledWith(ORGS)
  })

  test('falls back to prompt when flag is undefined', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue(ORGS)
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORGS[1]!)

    const result = await selectOrg(undefined)

    expect(result).toEqual(ORG_2)
    expect(selectOrganizationPrompt).toHaveBeenCalledWith(ORGS)
  })

  test('throws AbortError when no organizations are found', async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([])

    await expect(selectOrg()).rejects.toThrow('No organizations found.')
  })
})
