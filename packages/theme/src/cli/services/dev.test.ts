import {openURLSafely, renderLinks, createKeypressHandler} from './dev.js'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
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

const store = 'my-store.myshopify.com'
const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!

describe('renderLinks', () => {
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

describe('createKeypressHandler', () => {
  const urls = {
    local: 'http://127.0.0.1:9292',
    giftCard: 'http://127.0.0.1:9292/gift_cards/[store_id]/preview',
    themeEditor: 'https://my-store.myshopify.com/admin/themes/123/editor?hr=9292',
    preview: 'https://my-store.myshopify.com/?preview_theme_id=123',
  }

  const ctx = {lastRequestedPath: '/'}

  beforeEach(() => {
    vi.mocked(openURL).mockResolvedValue(true)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('opens localhost when "t" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('t', {name: 't'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.local)
  })

  test('opens theme preview when "p" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('p', {name: 'p'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.preview)
  })

  test('opens theme editor when "e" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('e', {name: 'e'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.themeEditor)
  })

  test('opens gift card preview when "g" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('g', {name: 'g'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.giftCard)
  })

  test('appends preview path to theme editor URL when lastRequestedPath is not "/"', () => {
    // Given
    const ctxWithPath = {lastRequestedPath: '/products/test-product'}
    const handler = createKeypressHandler(urls, ctxWithPath)

    // When
    handler('e', {name: 'e'})

    // Then
    expect(openURL).toHaveBeenCalledWith(
      `${urls.themeEditor}&previewPath=${encodeURIComponent('/products/test-product')}`,
    )
  })

  test('debounces rapid keypresses - only opens URL once during debounce window', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('t', {name: 't'})
    handler('t', {name: 't'})
    handler('t', {name: 't'})
    handler('t', {name: 't'})

    // Then
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledWith(urls.local)
  })

  test('allows keypresses after debounce period expires', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('t', {name: 't'})
    expect(openURL).toHaveBeenCalledTimes(1)

    handler('t', {name: 't'})
    handler('t', {name: 't'})
    expect(openURL).toHaveBeenCalledTimes(1)

    // Advance time to exceed debounce period
    vi.advanceTimersByTime(100)

    handler('p', {name: 'p'})

    // Then
    expect(openURL).toHaveBeenCalledTimes(2)
    expect(openURL).toHaveBeenNthCalledWith(1, urls.local)
    expect(openURL).toHaveBeenNthCalledWith(2, urls.preview)
  })

  test('debounces different keys during the same debounce window', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx)

    // When
    handler('t', {name: 't'})
    handler('p', {name: 'p'})
    handler('e', {name: 'e'})
    handler('g', {name: 'g'})

    // Then
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledWith(urls.local)
  })
})
