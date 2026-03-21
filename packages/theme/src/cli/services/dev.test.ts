import {dev, openURLSafely, renderLinks, createKeypressHandler} from './dev.js'
import {prepareStandardEventsSupport} from '../utilities/theme-environment/standard-events.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {ensureListingExists} from '../utilities/theme-listing.js'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'

vi.mock('../utilities/theme-fs.js', () => ({
  hasRequiredThemeDirectories: vi.fn().mockResolvedValue(true),
  mountThemeFileSystem: vi.fn().mockReturnValue({files: new Map(), uploadErrors: new Map()}),
}))
vi.mock('../utilities/theme-ui.js', () => ({
  ensureDirectoryConfirmed: vi.fn().mockResolvedValue(true),
}))
vi.mock('../utilities/theme-environment/theme-environment.js', () => ({
  setupDevServer: vi.fn(() => ({
    workPromise: Promise.resolve(),
    serverStart: vi.fn().mockResolvedValue({close: vi.fn().mockResolvedValue(undefined)}),
    dispatchEvent: vi.fn(),
    renderDevSetupProgress: vi.fn().mockResolvedValue(undefined),
    backgroundJobPromise: Promise.resolve(undefined as never),
  })),
}))
vi.mock('../utilities/theme-environment/standard-events.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utilities/theme-environment/standard-events.js')>()
  return {
    ...actual,
    prepareStandardEventsSupport: vi.fn().mockResolvedValue(undefined),
  }
})
vi.mock('../utilities/theme-environment/storefront-session.js', () => ({
  isStorefrontPasswordProtected: vi.fn().mockResolvedValue(false),
}))
vi.mock('../utilities/theme-environment/storefront-password-prompt.js', () => ({
  ensureValidPassword: vi.fn(),
}))
vi.mock('../utilities/theme-fs-empty.js', () => ({
  emptyThemeExtFileSystem: vi.fn(() => ({files: new Map()})),
}))
vi.mock('../utilities/theme-environment/dev-server-session.js', () => ({
  initializeDevServerSession: vi.fn().mockResolvedValue({
    token: 'token',
    storefrontToken: 'storefront-token',
    storeFqdn: 'my-store.myshopify.com',
    sessionCookies: {},
  }),
}))
vi.mock('../utilities/theme-listing.js', () => ({
  ensureListingExists: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@shopify/cli-kit/node/tcp', () => ({
  checkPortAvailability: vi.fn().mockResolvedValue(true),
  getAvailableTCPPort: vi.fn().mockResolvedValue(9292),
}))

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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {promise, resolve, reject}
}

beforeEach(() => {
  vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
  vi.mocked(mountThemeFileSystem).mockReturnValue({files: new Map(), uploadErrors: new Map()} as never)
  vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(true)
  vi.mocked(setupDevServer).mockReturnValue({
    workPromise: Promise.resolve(),
    serverStart: vi.fn().mockResolvedValue({close: vi.fn().mockResolvedValue(undefined)}),
    dispatchEvent: vi.fn(),
    renderDevSetupProgress: vi.fn().mockResolvedValue(undefined),
    backgroundJobPromise: Promise.resolve(undefined as never),
  })
  vi.mocked(prepareStandardEventsSupport).mockResolvedValue(undefined)
  vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
  vi.mocked(emptyThemeExtFileSystem).mockReturnValue({files: new Map()} as never)
  vi.mocked(initializeDevServerSession).mockResolvedValue({
    token: 'token',
    storefrontToken: 'storefront-token',
    storeFqdn: 'my-store.myshopify.com',
    sessionCookies: {},
  } as never)
  vi.mocked(ensureListingExists).mockResolvedValue(undefined)
  vi.mocked(checkPortAvailability).mockResolvedValue(true)
  vi.mocked(getAvailableTCPPort).mockResolvedValue(9292)
})

describe('dev', () => {
  test('prepares standard events support and propagates the option to the dev server context', async () => {
    const adminSession = {storeFqdn: store} as AdminSession

    await dev({
      adminSession,
      directory: '/tmp/theme',
      store,
      open: false,
      theme,
      force: false,
      'standard-events': true,
      'theme-editor-sync': false,
      'live-reload': 'hot-reload',
      'error-overlay': 'default',
      noDelete: false,
      ignore: [],
      only: [],
    })

    expect(prepareStandardEventsSupport).toHaveBeenCalledWith('/tmp/theme')
    expect(setupDevServer).toHaveBeenCalledWith(
      theme,
      expect.objectContaining({
        options: expect.objectContaining({standardEvents: true}),
      }),
    )
  })

  test('does not block dev startup on standard events setup', async () => {
    const adminSession = {storeFqdn: store} as AdminSession
    const standardEventsDeferred = createDeferred<void>()

    vi.mocked(prepareStandardEventsSupport).mockReturnValue(standardEventsDeferred.promise)

    const devPromise = dev({
      adminSession,
      directory: '/tmp/theme',
      store,
      open: false,
      theme,
      force: false,
      'standard-events': true,
      'theme-editor-sync': false,
      'live-reload': 'hot-reload',
      'error-overlay': 'default',
      noDelete: false,
      ignore: [],
      only: [],
    })

    await vi.waitFor(() => {
      expect(setupDevServer).toHaveBeenCalled()
      expect(prepareStandardEventsSupport).toHaveBeenCalledWith('/tmp/theme')
      expect(renderSuccess).toHaveBeenCalled()
    })

    standardEventsDeferred.resolve()
    await devPromise
  })

  test('warns when background standard events setup fails', async () => {
    const adminSession = {storeFqdn: store} as AdminSession
    const error = new Error('refresh failed')
    vi.mocked(prepareStandardEventsSupport).mockRejectedValue(error)

    await dev({
      adminSession,
      directory: '/tmp/theme',
      store,
      open: false,
      theme,
      force: false,
      'standard-events': true,
      'theme-editor-sync': false,
      'live-reload': 'hot-reload',
      'error-overlay': 'default',
      noDelete: false,
      ignore: [],
      only: [],
    })

    await vi.waitFor(() => {
      expect(renderWarning).toHaveBeenCalledWith({
        headline: 'Failed to update standard events support.',
        body: error.stack ?? error.message,
      })
    })
    expect(setupDevServer).toHaveBeenCalled()
  })
})

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
