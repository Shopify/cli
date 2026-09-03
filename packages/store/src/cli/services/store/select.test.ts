import {selectDevStore} from './select.js'
import * as bpSource from './list/bp-source.js'
import {type StoreListEntry} from './list/types.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {selectOrg} from '@shopify/organizations'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/organizations', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {...actual, selectOrg: vi.fn()}
})

const acme = {id: '1234', businessName: 'Acme'}

function storeEntry(overrides: Partial<StoreListEntry> = {}): StoreListEntry {
  return {
    store: 'shop.myshopify.com',
    createdAt: '2026-01-15T00:00:00Z',
    organizationId: '1234',
    organizationName: 'Acme',
    name: 'Shop',
    type: 'dev',
    ...overrides,
  }
}

function mockStores(entries: StoreListEntry[], hasMore = false) {
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  vi.mocked(selectOrg).mockResolvedValue(acme)
  return vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries, hasMore})
}

describe('selectDevStore', () => {
  test('asks Business Platform for the organization dev stores and returns the selection', async () => {
    const listStores = mockStores([
      storeEntry({store: 'first.myshopify.com', name: 'First'}),
      storeEntry({store: 'second.myshopify.com', name: 'Second'}),
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('second.myshopify.com')

    const selected = await selectDevStore({organizationId: '1234', message: 'Which dev store?'})

    expect(selectOrg).toHaveBeenCalledWith('1234')
    // The store type is filtered server-side, so the page holds dev stores rather than a mix.
    expect(listStores).toHaveBeenCalledWith({
      token: 'bp-token',
      organization: acme,
      storeTypeFilter: 'development_superset',
    })
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which dev store?',
      choices: [
        {label: 'First (first.myshopify.com)', value: 'first.myshopify.com'},
        {label: 'Second (second.myshopify.com)', value: 'second.myshopify.com'},
      ],
      hasMorePages: false,
      search: expect.any(Function),
    })
    expect(selected).toEqual({store: 'second.myshopify.com', organization: acme})
  })

  test('resolves the organization without an ID when none is provided', async () => {
    mockStores([storeEntry()])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(selectOrg).toHaveBeenCalledWith(undefined)
  })

  test('prompts for a lone dev store rather than auto-selecting it', async () => {
    mockStores([storeEntry()])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    const selected = await selectDevStore({message: 'Which dev store?'})

    expect(renderAutocompletePrompt).toHaveBeenCalledOnce()
    expect(selected).toEqual({store: 'shop.myshopify.com', organization: acme})
  })

  test('labels a store without a name by its domain alone', async () => {
    mockStores([storeEntry({name: undefined})])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(renderAutocompletePrompt).toHaveBeenCalledWith(
      expect.objectContaining({choices: [{label: 'shop.myshopify.com', value: 'shop.myshopify.com'}]}),
    )
  })

  test('searches Business Platform for stores beyond the fetched page', async () => {
    const listStores = mockStores([storeEntry({store: 'first.myshopify.com', name: 'First'})], true)
    vi.mocked(renderAutocompletePrompt).mockImplementation(async ({search}) => {
      listStores.mockResolvedValue({entries: [storeEntry({store: 'far.myshopify.com', name: 'Far'})], hasMore: false})
      const results = await search!('far')
      expect(results.data).toEqual([{label: 'Far (far.myshopify.com)', value: 'far.myshopify.com'}])
      return 'far.myshopify.com'
    })

    const selected = await selectDevStore({message: 'Which dev store?'})

    expect(listStores).toHaveBeenLastCalledWith({
      token: 'bp-token',
      organization: acme,
      storeTypeFilter: 'development_superset',
      searchTerm: 'far',
    })
    // The prompt reports the extra pages, so its hint to type a name is accurate.
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(expect.objectContaining({hasMorePages: true}))
    expect(selected).toEqual({store: 'far.myshopify.com', organization: acme})
  })

  test('aborts when the organization has no dev stores', async () => {
    mockStores([])

    await expect(selectDevStore({message: 'Which dev store?'})).rejects.toThrow(
      new AbortError(
        'No dev stores found in Acme.',
        'Create one with `shopify store create dev --organization-id 1234`.',
      ),
    )
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })
})
