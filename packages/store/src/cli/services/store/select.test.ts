import {selectDevStore} from './select.js'
import * as bpSource from './list/bp-source.js'
import {type StoreListEntry} from './list/types.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {selectOrg} from '@shopify/organizations'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/organizations')

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
  vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries, hasMore})
}

describe('selectDevStore', () => {
  test('prompts with the organization dev stores and returns the selection', async () => {
    mockStores([
      storeEntry({store: 'first.myshopify.com', name: 'First'}),
      storeEntry({store: 'second.myshopify.com', name: 'Second'}),
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('second.myshopify.com')

    const selected = await selectDevStore({organizationId: '1234', message: 'Which dev store?'})

    expect(selectOrg).toHaveBeenCalledWith('1234')
    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({token: 'bp-token', organization: acme})
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which dev store?',
      choices: [
        {label: 'First (first.myshopify.com)', value: 'first.myshopify.com'},
        {label: 'Second (second.myshopify.com)', value: 'second.myshopify.com'},
      ],
    })
    expect(selected).toEqual({store: 'second.myshopify.com', organization: acme})
  })

  test('resolves the organization without an ID when none is provided', async () => {
    mockStores([storeEntry()])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(selectOrg).toHaveBeenCalledWith(undefined)
  })

  test('labels a store without a name by its domain alone', async () => {
    mockStores([storeEntry({name: undefined})])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(renderAutocompletePrompt).toHaveBeenCalledWith(
      expect.objectContaining({choices: [{label: 'shop.myshopify.com', value: 'shop.myshopify.com'}]}),
    )
  })

  test('offers only the dev stores in the organization', async () => {
    mockStores([
      storeEntry({store: 'dev.myshopify.com', name: 'Dev', type: 'dev'}),
      storeEntry({store: 'live.myshopify.com', name: 'Live', type: 'production'}),
      storeEntry({store: 'unknown.myshopify.com', name: 'Unknown', type: undefined}),
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('dev.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(renderAutocompletePrompt).toHaveBeenCalledWith(
      expect.objectContaining({choices: [{label: 'Dev (dev.myshopify.com)', value: 'dev.myshopify.com'}]}),
    )
  })

  test('aborts when the organization has no dev stores', async () => {
    mockStores([storeEntry({type: 'production'})])

    await expect(selectDevStore({message: 'Which dev store?'})).rejects.toThrow(
      new AbortError(
        'No dev stores found in Acme.',
        'Create one with `shopify store create dev --organization-id 1234`.',
      ),
    )
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('warns that stores beyond the fetched page are missing from the choices', async () => {
    mockStores([storeEntry()], true)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(outputWarn).toHaveBeenCalledWith(
      "Showing the dev stores among the 250 most recent stores in Acme. More stores exist: use `--store` to name one that isn't listed.",
    )
  })

  test('does not warn when every store was fetched', async () => {
    mockStores([storeEntry()])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('shop.myshopify.com')

    await selectDevStore({message: 'Which dev store?'})

    expect(outputWarn).not.toHaveBeenCalled()
  })
})
