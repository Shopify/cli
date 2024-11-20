import {run} from './run.js'
import {checkScript} from './check.js'
import {fetchStoreThemes} from '../../utilities/theme-selector/fetch.js'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import * as ui from '@shopify/cli-kit/node/ui'
import {upgradeTheme, fetchTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'

vi.mock('./check.js')
vi.mock('../../utilities/theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/themes/themes-api')

describe('run', () => {
  beforeEach(() => {
    vi.spyOn(ui, 'renderSuccess')
    vi.mocked(readFile).mockResolvedValue(Buffer.from('{}'))
    vi.mocked(fetchStoreThemes).mockResolvedValue([
      theme({id: 123, processing: false}),
      theme({id: 456, processing: false}),
    ])
  })

  test('when the script runs successfully', async () => {
    // Given
    vi.mocked(upgradeTheme).mockResolvedValue(theme({id: 789, processing: true}))
    vi.mocked(fetchTheme).mockResolvedValueOnce(theme({id: 789, processing: false}))

    // When
    await run(session(), {script: '', 'from-theme': '123', 'to-theme': '456'})

    // Then
    expect(ui.renderSuccess).toBeCalledWith({
      body: 'Your theme has been updated.',
      nextSteps: [
        [
          {
            link: {
              label: 'Explore the updated theme in the code editor',
              url: 'https://my-shop.myshopify.com/admin/themes/789',
            },
          },
        ],
        [
          {
            link: {
              label: 'Explore the updated theme in the theme editor',
              url: 'https://my-shop.myshopify.com/admin/themes/789/editor',
            },
          },
        ],
        [
          {
            link: {
              label: 'Preview the updated theme',
              url: 'https://my-shop.myshopify.com?preview_theme_id=789',
            },
          },
        ],
      ],
    })
  })

  test('when the file is invalid', async () => {
    // Given
    vi.mocked(checkScript).mockRejectedValue(new AbortError('Error during check'))

    await expect(async () => {
      // When
      await run(session(), {script: '', 'from-theme': '123', 'to-theme': '456'})

      // Then
    }).rejects.toThrowError(AbortError)
  })

  test('when the theme cannot be created', async () => {
    // Given
    vi.mocked(upgradeTheme).mockResolvedValue(undefined)

    await expect(async () => {
      // When
      await run(session(), {script: '', 'from-theme': '123', 'to-theme': '456'})

      // Then
    }).rejects.toThrowError(/The update process could not be triggered/)
  })

  test('when polling fails', async () => {
    // Given
    vi.mocked(upgradeTheme).mockResolvedValue(theme({id: 789, processing: true}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)

    await expect(async () => {
      // When
      await run(session(), {script: '', 'from-theme': '123', 'to-theme': '456'})

      // Then
    }).rejects.toThrowError(/The `update_extension.json` script could not be executed/)
  })

  test("when the theme doesn't exist", async () => {
    // Given
    vi.mocked(upgradeTheme).mockResolvedValue(undefined)

    await expect(async () => {
      // When
      await run(session(), {script: '', 'from-theme': '012', 'to-theme': '456'})

      // Then
    }).rejects.toThrowError(/The my-shop.myshopify.com store doesn't have a theme with the "012" ID/)
  })
})

function session() {
  return {
    token: 'token',
    storeFqdn: 'my-shop.myshopify.com',
  }
}

function theme(attributes: {id: number; processing: boolean}) {
  const {id, processing} = attributes
  return new Theme(id, 'updated-theme', 'unpublished', false, processing)
}
