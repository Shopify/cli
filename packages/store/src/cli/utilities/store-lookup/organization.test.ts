import {findStoreOwningOrganization, resolveOrganizationForStore} from './organization.js'
import {fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationsWithAccessInfo, selectOrg, selectOrganizationPrompt} from '@shopify/organizations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('./destinations.js')
vi.mock('@shopify/cli-kit/node/system')

vi.mock('@shopify/organizations', () => ({
  fetchOrganizationsWithAccessInfo: vi.fn(),
  selectOrg: vi.fn(),
  selectOrganizationPrompt: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')

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
  const details = {status: 'ACTIVE', shopCount: 1, url: 'https://admin.shopify.com/org'} as const
  const selectedOrg = {id: '12345', businessName: 'Selected Org', ...details}
  const inferredOrg = {id: '67890', businessName: 'Inferred Org'}
  const otherOrg = {id: '24680', businessName: 'Other Org', ...details}

  beforeEach(() => {
    vi.mocked(selectOrg).mockResolvedValue(selectedOrg)
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [selectedOrg, otherOrg],
      currentUserResolved: true,
    })
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(selectedOrg)
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: {id: '67890', name: 'Inferred Org'}})
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    mockAndCaptureOutput().clear()
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

    expect(selectOrganizationPrompt).toHaveBeenCalledWith([selectedOrg, otherOrg])
    expect(organization).toEqual(selectedOrg)
  })

  test('uses the only organization the account belongs to when ownership cannot be inferred', async () => {
    // A service account can only open the stores it created, so the destinations lookup misses the rest of
    // its organization's stores. It belongs to one organization, which is the one to use.
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: undefined})
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [otherOrg],
      currentUserResolved: true,
    })
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
    const output = mockAndCaptureOutput()

    const organization = await resolveOrganizationForStore(STORE)

    expect(organization).toEqual(otherOrg)
    // Non-interactive runs never prompt to log in; the same token the lookup used lists the organizations.
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: true, allowAutomationToken: true})
    expect(fetchOrganizationsWithAccessInfo).toHaveBeenCalledWith('bp-token')
    expect(selectOrganizationPrompt).not.toHaveBeenCalled()
    expect(output.info()).toBe('')
  })

  test('reports that there are no organizations when the account belongs to none', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: undefined})
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({organizations: [], currentUserResolved: true})

    await expect(resolveOrganizationForStore(STORE)).rejects.toThrow('No organizations found.')
  })

  test('explains why the organization prompt is appearing, naming the store the developer provided', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: undefined})
    const output = mockAndCaptureOutput()

    await resolveOrganizationForStore(STORE)

    expect(output.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Could not determine which organization owns shop.myshopify.com.             │
      │                                                                              │
      │  Select one below, or specify it with \`--organization-id\`.                   │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('stays quiet when the owning organization is inferred', async () => {
    const output = mockAndCaptureOutput()

    await resolveOrganizationForStore(STORE)

    expect(output.info()).toBe('')
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
    expect(selectOrganizationPrompt).not.toHaveBeenCalled()
  })
})
