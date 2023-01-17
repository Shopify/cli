import {list} from './list.js'
import {columns} from './list.columns.js'
import {fetchStoreThemes} from '../utilities/theme-selector/fetch.js'
import {Theme} from '../models/theme.js'
import {renderTable} from '@shopify/cli-kit/node/ui.js'
import {describe, expect, it, vi} from 'vitest'

vi.mock('../utilities/theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui.js')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

describe('list', () => {
  it('should call the table render function, with correctly formatted data', async () => {
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1361, name: 'Dawn', role: 'live'},
      {id: 1363, name: 'Studio', role: ''},
    ] as Theme[])

    await list(session, {})

    expect(renderTable).toBeCalledWith({
      rows: [
        {id: '#1361', name: 'Dawn', role: '[live]'},
        {id: '#1363', name: 'Studio', role: ''},
      ],
      columns,
    })
  })

  it('should call the table render function, with correctly formatted and filtered data', async () => {
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'unpublished'},
      {id: 2, name: 'Theme 2', role: 'demo'},
      {id: 3, name: 'Theme 3', role: 'live'},
      {id: 5, name: 'Theme 5', role: 'development'},
    ] as Theme[])

    await list(session, {role: 'live', name: 'eMe 3'})

    expect(renderTable).toBeCalledWith({
      rows: [{id: '#3', name: 'Theme 3', role: '[live]'}],
      columns,
    })
  })
})
