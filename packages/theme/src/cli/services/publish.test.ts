import {publish as executePublish} from './publish.js'
import {renderThemePublishResult} from './publish/result.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {renderSuccess, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi} from 'vitest'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {themePublish} from '@shopify/cli-kit/node/themes/api'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-selector.js')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme = {
  id: 1,
  name: 'my theme',
} as Theme

const options = {
  force: false,
  theme: '1',
}

describe('publish', () => {
  test('prompts for confirmation, publishes the theme and renders the theme link', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(themePublish).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    await publish(session, options)

    // Then
    expect(renderConfirmationPrompt).toBeCalledWith({
      message: `Do you want to make 'my theme' the new live theme on my-shop.myshopify.com?`,
      confirmationMessage: `Yes, make 'my theme' the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })

    expect(renderSuccess).toBeCalledWith({
      body: [
        'The theme',
        "'my theme'",
        {subdued: `(#1)`},
        'is now live at',
        {
          link: {
            label: 'https://my-shop.myshopify.com',
            url: 'https://my-shop.myshopify.com',
          },
        },
        {char: '.'},
      ],
    })
  })

  test('prompts for confirmation, does not publish when cancelled', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(themePublish).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    await publish(session, options)

    // Then
    expect(renderConfirmationPrompt).toBeCalledWith({
      message: `Do you want to make 'my theme' the new live theme on my-shop.myshopify.com?`,
      confirmationMessage: `Yes, make 'my theme' the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })
    expect(renderSuccess).not.toBeCalled()
  })

  test('when using --force, does not prompt for confirmation and publishes', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(themePublish).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    await publish(session, {...options, force: true})

    // Then
    expect(renderConfirmationPrompt).not.toBeCalled()
    expect(renderSuccess).toBeCalledWith({
      body: [
        'The theme',
        "'my theme'",
        {subdued: `(#1)`},
        'is now live at',
        {
          link: {
            label: 'https://my-shop.myshopify.com',
            url: 'https://my-shop.myshopify.com',
          },
        },
        {char: '.'},
      ],
    })
  })
})

async function publish(...args: Parameters<typeof executePublish>) {
  const result = await executePublish(...args)
  if (result) renderThemePublishResult(result, 'text')
  return result
}

test('returns the published API data without presenting a final result', async () => {
  const publishedTheme = {...theme, name: 'Published name', role: 'live', processing: false, createdAtRuntime: false}
  vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
  vi.mocked(themePublish).mockResolvedValue(publishedTheme)
  const result = await executePublish(session, {...options, force: true})
  expect(result).toEqual({
    data: {theme: {...publishedTheme, shop: session.storeFqdn}},
    originalTheme: theme,
    previewUrl: 'https://my-shop.myshopify.com',
  })
  expect(renderSuccess).not.toHaveBeenCalled()
})

test('skips confirmation when already confirmed for multiple environments', async () => {
  vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
  vi.mocked(themePublish).mockResolvedValue(theme)
  await executePublish(session, options, true)
  expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  expect(themePublish).toHaveBeenCalledWith(1, session)
})

test('keeps the original theme name and environment label in terminal output', async () => {
  vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
  vi.mocked(themePublish).mockResolvedValue({...theme, name: 'Canonical name', role: 'live'})
  const result = await executePublish(session, {...options, force: true})
  renderThemePublishResult(result!, 'text', ['staging'])
  expect(renderSuccess).toHaveBeenCalledWith({
    headline: 'Environment: staging',
    body: [
      'The theme',
      "'my theme'",
      {subdued: '(#1)'},
      'is now live at',
      {link: {label: 'https://my-shop.myshopify.com', url: 'https://my-shop.myshopify.com'}},
      {char: '.'},
    ],
  })
})
