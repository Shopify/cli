import {findStoreOwningOrganization, resolveOrganizationForStore} from './organization.js'
import {fetchDestinationsContext} from './destinations.js'
import {selectOrg} from '@shopify/organizations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('./destinations.js')
vi.mock('@shopify/cli-kit/node/system')

vi.mock('@shopify/organizations', () => ({
  selectOrg: vi.fn(),
}))

const STORE = 'shop.myshopify.com'

describe('findStoreOwningOrganization', () => {
  test('maps the destination owning org into an organizations package Organization', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: {id: '1234', name: 'Acme'}})

    const organization = await findStoreOwningOrganization({store: STORE, noPrompt: true})

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: STORE, noPrompt: true})
    expect(organization).toEqual({id: '1234', businessName: 'Acme'})
  })

  test('returns undefined when the destination lookup cannot resolve an org id', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: {name: 'Acme'}})

    await expect(findStoreOwningOrganization({store: STORE})).resolves.toBeUndefined()
  })

  test('returns undefined when the destination lookup fails', async () => {
    vi.mocked(fetchDestinationsContext).mockRejectedValue(new Error('not found'))

    await expect(findStoreOwningOrganization({store: STORE})).resolves.toBeUndefined()
  })
})

describe('resolveOrganizationForStore', () => {
  const selectedOrg = {id: '12345', businessName: 'Selected Org'}
  const inferredOrg = {id: '67890', businessName: 'Inferred Org'}

  beforeEach(() => {
    vi.mocked(selectOrg).mockResolvedValue(selectedOrg)
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: {id: '67890', name: 'Inferred Org'}})
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  })

  test('selects the organization by ID when an organization ID is provided', async () => {
    const organization = await resolveOrganizationForStore(STORE, '12345')

    expect(selectOrg).toHaveBeenCalledWith('12345')
    expect(fetchDestinationsContext).not.toHaveBeenCalled()
    expect(organization).toEqual(selectedOrg)
  })

  test('infers the owning organization from the store when no organization ID is provided', async () => {
    const organization = await resolveOrganizationForStore(STORE)

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: STORE, noPrompt: false})
    expect(selectOrg).not.toHaveBeenCalled()
    expect(organization).toEqual(inferredOrg)
  })

  test('falls back to prompting for the organization when running interactively and ownership cannot be inferred', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: undefined})

    const organization = await resolveOrganizationForStore(STORE)

    expect(selectOrg).toHaveBeenCalledWith()
    expect(organization).toEqual(selectedOrg)
  })

  test('does not prompt non-interactively when ownership can be inferred', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    const organization = await resolveOrganizationForStore(STORE)

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: STORE, noPrompt: true})
    expect(selectOrg).not.toHaveBeenCalled()
    expect(organization).toEqual(inferredOrg)
  })

  test('throws an AbortError non-interactively when ownership cannot be inferred', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: undefined})

    await expect(resolveOrganizationForStore(STORE)).rejects.toThrow(AbortError)
    expect(selectOrg).not.toHaveBeenCalled()
  })
})
