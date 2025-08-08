import {themesDelete} from './delete.js'
import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {themeDelete} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'
import {renderConfirmationPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-selector.js')
vi.mock('../utilities/development-theme-manager.js', () => {
  const DevelopmentThemeManager = vi.fn()
  DevelopmentThemeManager.prototype.find = () => theme1
  return {DevelopmentThemeManager}
})

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme1 = {
  id: 1,
  name: 'my theme',
} as Theme

const theme2 = {
  id: 2,
  name: 'another theme',
} as Theme

const options = {
  selectTheme: false,
  development: false,
  force: false,
  themes: [],
}

describe('themesDelete', () => {
  test('deletes the development theme', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1])

    // When
    await themesDelete(session, {...options, development: true})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my theme'", {subdued: '(#1)'}, 'was deleted from my-shop.myshopify.com.'],
    })
  })

  test('deletes the selected theme', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme1)

    // When
    await themesDelete(session, options)

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my theme'", {subdued: '(#1)'}, 'was deleted from my-shop.myshopify.com.'],
    })
  })

  test('deletes the many themes', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(themeDelete).toBeCalledWith(theme2.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: [
        'The following themes were deleted from my-shop.myshopify.com:',
        {
          list: {
            items: [
              ["'my theme'", {subdued: '(#1)'}],
              ["'another theme'", {subdued: '(#2)'}],
            ],
          },
        },
      ],
    })
  })

  test('deletes themes without confirmation with the force flag is passed', async () => {
    // Given
    const confirmed = false

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, force: true, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(themeDelete).toBeCalledWith(theme2.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: [
        'The following themes were deleted from my-shop.myshopify.com:',
        {
          list: {
            items: [
              ["'my theme'", {subdued: '(#1)'}],
              ["'another theme'", {subdued: '(#2)'}],
            ],
          },
        },
      ],
    })
  })

  test("doesn't delete any theme when options is not confirmed", async () => {
    // Given
    const confirmed = false

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).not.toBeCalled()
    expect(renderSuccess).not.toBeCalled()
  })
})
