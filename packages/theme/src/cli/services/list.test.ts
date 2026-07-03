import {getDevelopmentTheme} from './local-storage.js'
import {list} from './list.js'
import {fetchStoreThemes} from '../utilities/theme-selector/fetch.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {render as renderInk} from '@shopify/cli-kit/node/testing/ui'
import {unstyled} from '@shopify/cli-kit/node/output'
import {JSX} from 'react'

vi.mock('../utilities/theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/conf')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('./local-storage.js')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

describe('list', () => {
  beforeEach(() => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
  })

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
              ['Theme 5', '[development] [current]', '#5'],
              ['Theme 6', '[development] [current]', '#6'],
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

  test('should include the environment section in the non-TTY fallback when an environment is passed', async () => {
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'live'},
      {id: 2, name: 'Theme 2', role: ''},
    ] as Theme[])

    await list({json: false, environment: 'staging'}, session)

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: [
        {
          title: 'my-shop.myshopify.com theme library',
          body: [{subdued: 'Environment name: staging'}],
        },
        {
          title: '',
          body: {
            tabularData: [
              ['name', 'role', 'id'],
              ['───────────────────────────────', '──────────────────────', '──────────────'],
              ['Theme 1', '[live]', '#1'],
              ['Theme 2', '', '#2'],
            ],
          },
        },
      ],
    })
  })

  test('should render the styled panel when the terminal supports prompting', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      {id: 1, name: 'Theme 1', role: 'live'},
      {id: 2, name: 'Theme 2', role: 'development'},
      {id: 3, name: 'Theme 3', role: 'unpublished'},
    ] as Theme[])
    vi.mocked(getDevelopmentTheme).mockReturnValue('2')

    await list({json: false}, session)

    expect(render).toHaveBeenCalledOnce()
    expect(renderInfo).not.toHaveBeenCalled()

    const view = vi.mocked(render).mock.calls[0]![0] as JSX.Element
    const {lastFrame} = renderInk(view)
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  my-shop.myshopify.com theme library                                                             │
      │  name     role                   id                                                              │
      │  Theme 1  ● live                 #1                                                              │
      │  Theme 2  development (current)  #2                                                              │
      │  Theme 3  unpublished            #3                                                              │
      │                                                                                                  │
      │  3 themes                                                                                        │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
      "
    `)
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
          "id": 1,
          "name": "Theme 1",
          "role": "live"
        },
        {
          "id": 2,
          "name": "Theme 2",
          "role": ""
        }
      ]"
    `)
  })
})
