import {openURLSafely, renderLinks} from './dev.js'
import {ensureLiveThemeConfirmed} from '../utilities/theme-ui.js'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderConfirmationPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/colors', () => ({
  default: {
    bold: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
  },
}))
vi.mock('@shopify/cli-kit/node/system', () => ({
  openURL: vi.fn(),
}))

describe('dev', () => {
  const store = 'my-store.myshopify.com'
  const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!
  const liveTheme = buildTheme({id: 123, name: 'My Theme', role: LIVE_THEME_ROLE})!

  test('renders "dev" command links', async () => {
    // Given
    const themeId = theme.id.toString()
    const host = '127.0.0.1'
    const port = '9292'
    const urls = {
      local: `http://${host}:${port}`,
      giftCard: `http://${host}:${port}/gift_cards/[store_id]/preview`,
      themeEditor: `https://${store}/admin/themes/${themeId}/editor?hr=${port}`,
      preview: `https://${store}/?preview_theme_id=${themeId}`,
    }

    // When
    renderLinks(urls)

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        {
          list: {
            title: 'Preview your theme (t)',
            items: [
              {
                link: {
                  url: 'http://127.0.0.1:9292',
                },
              },
            ],
          },
        },
      ],
      nextSteps: [
        [
          {
            link: {
              label: `Share your theme preview (p)`,
              url: `https://${store}/?preview_theme_id=${themeId}`,
            },
          },
          {
            subdued: `https://${store}/?preview_theme_id=${themeId}`,
          },
        ],
        [
          {
            link: {
              label: `Customize your theme at the theme editor (e)`,
              url: `https://${store}/admin/themes/${themeId}/editor?hr=9292`,
            },
          },
        ],
        [
          {
            link: {
              label: 'Preview your gift cards (g)',
              url: 'http://127.0.0.1:9292/gift_cards/[store_id]/preview',
            },
          },
        ],
      ],
    })
  })
  describe('openURLSafely', () => {
    test('calls renderWarning when openURL fails', async () => {
      // Given
      const error = new Error('Failed to open URL')
      vi.mocked(openURL).mockRejectedValueOnce(error)

      // When
      openURLSafely('http://127.0.0.1:9292', 'localhost')

      // Then
      await vi.waitFor(() => {
        expect(renderWarning).toHaveBeenCalledWith({
          headline: 'Failed to open localhost.',
          body: error.stack ?? error.message,
        })
      })
    })
  })
  describe('ensureLiveThemeConfirmed', () => {
    vi.stubGlobal('process', {...process, stdout: {...process.stdout, isTTY: true}})

    test('prompts for confirmation if acting on a live theme', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      const result = await ensureLiveThemeConfirmed(liveTheme, 'start development mode', false)

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message:
          'You\'re about to start development mode on your live theme "My Theme". This will make changes visible to customers. Are you sure you want to proceed?',
        confirmationMessage: 'Yes, proceed with live theme',
        cancellationMessage: 'No, cancel',
      })
      expect(result).toBe(true)
    })

    test('does not prompt for confirmation if acting on a non-live theme', async () => {
      // Given
      await ensureLiveThemeConfirmed(theme, 'start development mode', false)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    })

    test('does not prompt for confirmation if acting on a live theme and allowLive flag is true', async () => {
      // Given
      await ensureLiveThemeConfirmed(liveTheme, 'start development mode', true)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    })
  })
})
