import {list} from './list.js'
import {getDevelopmentTheme} from './local-storage.js'
import {fetchStoreThemes} from '../utilities/theme-selector/fetch.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../utilities/theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/conf')
vi.mock('./local-storage.js')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

describe('list', () => {
  test('should call the renderInfo function, with correctly formatted data', async () => {
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

    await list({json: false}, session)

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: [
        {
          title: '',
          body: {
            tabularData: [
              ['name', 'role', 'id'],
              ['───────────────────────────────', '──────────────────────', '──────────────'],
              ['Theme 1', '[live]', '#1'],
              ['Theme 2', '', '#2'],
              ['Theme 3', '[development]', '#3'],
              ['Theme 5', '[development] [yours]', '#5'],
              ['Theme 6', '[development] [yours]', '#6'],
            ],
          },
        },
      ],
    })
  })

  test('should call the renderInfo function, with correctly formatted and filtered data', async () => {
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'unpublished'},
      {id: 2, name: 'Theme 2', role: 'demo'},
      {id: 3, name: 'Theme 3', role: 'live'},
      {id: 5, name: 'Theme 5', role: 'development'},
    ] as Theme[])

    await list({role: 'live', name: '*eMe 3*', json: false}, session)

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: [
        {
          title: '',
          body: {
            tabularData: [
              ['name', 'role', 'id'],
              ['───────────────────────────────', '──────────────────────', '──────────────'],
              ['Theme 3', '[live]', '#3'],
            ],
          },
        },
      ],
    })
  })

  test('should output in json format', async () => {
    const mockOutput = mockAndCaptureOutput()

    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'live'},
      {id: 2, name: 'Theme 2', role: ''},
    ] as Theme[])

    await list({json: true}, session)

    expect(mockOutput.info()).toMatchInlineSnapshot(`
    "[
      {
        \\"id\\": 1,
        \\"name\\": \\"Theme 1\\",
        \\"role\\": \\"live\\"
      },
      {
        \\"id\\": 2,
        \\"name\\": \\"Theme 2\\",
        \\"role\\": \\"\\"
      }
    ]"
  `)
  })
})
