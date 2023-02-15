import {list} from './list.js'
import {columns} from './list.columns.js'
import {getDevelopmentTheme} from './local-storage.js'
import {fetchStoreThemes} from '../utilities/theme-selector/fetch.js'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {describe, expect, it, vi} from 'vitest'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'

vi.mock('../utilities/theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/conf')
vi.mock('./local-storage.js')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

describe('list', () => {
  it('should call the table render function, with correctly formatted data', async () => {
    const developmentThemeId = 5
    const hostThemeId = 6
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'live'},
      {id: 2, name: 'Theme 2', role: ''},
      {id: 3, name: 'Theme 3', role: 'development'},
      {id: developmentThemeId, name: 'Theme 5', role: 'development'},
      {id: hostThemeId, name: 'Theme 6', role: 'development'},
    ] as Theme[])
    vi.mocked(getDevelopmentTheme).mockReturnValue(developmentThemeId.toString())
    vi.mocked(getHostTheme).mockReturnValue(hostThemeId.toString())

    await list(session, {})

    expect(renderTable).toBeCalledWith({
      rows: [
        {id: '#1', name: 'Theme 1', role: '[live]'},
        {id: '#2', name: 'Theme 2', role: ''},
        {id: '#3', name: 'Theme 3', role: '[development]'},
        {id: '#5', name: 'Theme 5', role: '[development] [yours]'},
        {id: '#6', name: 'Theme 6', role: '[development] [yours]'},
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
