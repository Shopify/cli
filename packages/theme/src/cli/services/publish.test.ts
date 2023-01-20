import {publish} from './publish.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '../models/theme.js'
import {publishTheme} from '../utilities/themes-api.js'
import {renderSuccess, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../utilities/theme-selector.js')
vi.mock('../utilities/themes-api')

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
    vi.mocked(publishTheme).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    await publish(session, '1', options)

    // Then
    expect(renderConfirmationPrompt).toBeCalledWith({
      message: `Are you sure you want to make my theme the new live theme on https://my-shop.myshopify.com ?`,
      confirmationMessage: `Yes, make my theme the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })

    expect(renderSuccess).toBeCalledWith({
      headline: [
        'The theme',
        'my theme',
        {subdued: `(#1)`},
        'is now live at',
        {
          link: {
            label: 'https://my-shop.myshopify.com',
            url: 'https://my-shop.myshopify.com',
          },
        },
      ],
    })
  })

  test('prompts for confirmation, does not publish when cancelled', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(publishTheme).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    await publish(session, '1', options)

    // Then
    expect(renderConfirmationPrompt).toBeCalledWith({
      message: `Are you sure you want to make my theme the new live theme on https://my-shop.myshopify.com ?`,
      confirmationMessage: `Yes, make my theme the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })
    expect(renderSuccess).not.toBeCalled()
  })

  test('when using --force, does not prompt for confirmation and publishes', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(publishTheme).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    await publish(session, '1', {...options, force: true})

    // Then
    expect(renderConfirmationPrompt).not.toBeCalled()
    expect(renderSuccess).toBeCalledWith({
      headline: [
        'The theme',
        'my theme',
        {subdued: `(#1)`},
        'is now live at',
        {
          link: {
            label: 'https://my-shop.myshopify.com',
            url: 'https://my-shop.myshopify.com',
          },
        },
      ],
    })
  })
})
