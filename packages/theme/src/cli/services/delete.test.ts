import {deleteThemes, renderDeprecatedArgsWarning} from './delete.js'
import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {deleteTheme} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'
import {renderConfirmationPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

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

describe('deleteThemes', () => {
  test('deletes the development theme', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1])

    // When
    await deleteThemes(session, {...options, development: true})

    // Then
    expect(deleteTheme).toBeCalledWith(theme1.id, session)
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
    await deleteThemes(session, options)

    // Then
    expect(deleteTheme).toBeCalledWith(theme1.id, session)
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
    await deleteThemes(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(deleteTheme).toBeCalledWith(theme1.id, session)
    expect(deleteTheme).toBeCalledWith(theme2.id, session)
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
    await deleteThemes(session, {...options, force: true, themes: ['my theme', '2']})

    // Then
    expect(deleteTheme).toBeCalledWith(theme1.id, session)
    expect(deleteTheme).toBeCalledWith(theme2.id, session)
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
    await deleteThemes(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(deleteTheme).not.toBeCalled()
    expect(renderSuccess).not.toBeCalled()
  })
})

describe('renderDeprecatedArgsWarning', () => {
  test('renders the the deprecated-args warning message', async () => {
    // Given/When
    renderDeprecatedArgsWarning(['1', '2'])

    // Then
    expect(renderWarning).toBeCalledWith({
      body: [
        'Positional arguments are deprecated. Use the',
        {command: '--theme'},
        'flag instead:\n\n',
        {command: `$ shopify theme delete --theme 1 2`},
        {char: '.'},
      ],
    })
  })
})
