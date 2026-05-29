import {
  dev,
  openURLSafely,
  renderLinks,
  createKeypressHandler,
  reportDevAnalytics,
  storefrontFqdnForThemeDev,
  themeEditorUrlForThemeDev,
} from './dev.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {describe, expect, test, vi, beforeEach, afterEach, type MockInstance} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {getAvailableTCPPort, checkPortAvailability} from '@shopify/cli-kit/node/tcp'
import {Config} from '@oclif/core'

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
vi.mock('@shopify/cli-kit/node/context/fqdn', () => ({
  storeAdminUrl: (storeFqdn: string) => {
    if (storeFqdn.endsWith('.my.shop.dev')) {
      return `admin.shop.dev/store/${storeFqdn.replace('.my.shop.dev', '')}`
    }
    return storeFqdn
  },
}))
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  reportAnalyticsEvent: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/tcp', () => ({
  getAvailableTCPPort: vi.fn(),
  checkPortAvailability: vi.fn(),
}))
vi.mock('../utilities/theme-environment/theme-environment.js', () => ({
  setupDevServer: vi.fn(),
}))
vi.mock('../utilities/theme-fs.js', () => ({
  hasRequiredThemeDirectories: vi.fn(),
  mountThemeFileSystem: vi.fn().mockReturnValue({}),
}))
vi.mock('../utilities/theme-fs-empty.js', () => ({
  emptyThemeExtFileSystem: vi.fn().mockReturnValue({}),
}))
vi.mock('../utilities/theme-environment/storefront-session.js', () => ({
  isStorefrontPasswordProtected: vi.fn(),
}))
vi.mock('../utilities/theme-environment/dev-server-session.js', () => ({
  initializeDevServerSession: vi.fn(),
}))

const store = 'my-store.myshopify.com'
const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!

describe('storefrontFqdnForThemeDev', () => {
  test('defaults to the store host', () => {
    expect(storefrontFqdnForThemeDev('preview-1780041822.dev-api.shop.dev')).toBe(
      'preview-1780041822.dev-api.shop.dev',
    )
  })

  test('uses an explicit storefront host override when provided', () => {
    expect(storefrontFqdnForThemeDev('preview-1780041822.dev-api.shop.dev', 'preview-1780041822.my.shop.dev')).toBe(
      'preview-1780041822.my.shop.dev',
    )
  })
})

describe('themeEditorUrlForThemeDev', () => {
  test('uses standard theme editor URLs for regular stores', () => {
    expect(themeEditorUrlForThemeDev('my-store.myshopify.com', 123, '9292')).toBe(
      'https://my-store.myshopify.com/admin/themes/123/editor?hr=9292',
    )
  })

  test('uses local admin web URLs for dev-api store hosts', () => {
    expect(themeEditorUrlForThemeDev('preview-1780041822.dev-api.shop.dev', 84, '9292')).toBe(
      'https://admin.shop.dev/store/preview-1780041822/themes/84/editor?hr=9292',
    )
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
    const handler = createKeypressHandler(urls, ctx, vi.fn())

    // When
    handler('t', {name: 't'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.local)
  })

  test('opens theme preview when "p" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx, vi.fn())

    // When
    handler('p', {name: 'p'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.preview)
  })

  test('opens theme editor when "e" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx, vi.fn())

    // When
    handler('e', {name: 'e'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.themeEditor)
  })

  test('opens gift card preview when "g" is pressed', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx, vi.fn())

    // When
    handler('g', {name: 'g'})

    // Then
    expect(openURL).toHaveBeenCalledWith(urls.giftCard)
  })

  test('appends preview path to theme editor URL when lastRequestedPath is not "/"', () => {
    // Given
    const ctxWithPath = {lastRequestedPath: '/products/test-product'}
    const handler = createKeypressHandler(urls, ctxWithPath, vi.fn())

    // When
    handler('e', {name: 'e'})

    // Then
    expect(openURL).toHaveBeenCalledWith(
      `${urls.themeEditor}&previewPath=${encodeURIComponent('/products/test-product')}`,
    )
  })

  test('debounces rapid keypresses - only opens URL once during debounce window', () => {
    // Given
    const handler = createKeypressHandler(urls, ctx, vi.fn())

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
    const handler = createKeypressHandler(urls, ctx, vi.fn())

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
    const handler = createKeypressHandler(urls, ctx, vi.fn())

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

describe('dev() Ctrl-C analytics', () => {
  const mockConfig = {} as unknown as Config
  const adminSession = {storeFqdn: 'test.myshopify.com', token: 'x'}

  let exitSpy: MockInstance
  let resolveBackgroundJob: () => void

  const baseOptions = {
    adminSession,
    commandConfig: mockConfig,
    directory: '/tmp/theme',
    store: 'test.myshopify.com',
    open: false,
    theme,
    force: false,
    'theme-editor-sync': false,
    'live-reload': 'hot-reload' as const,
    'error-overlay': 'default' as const,
    noDelete: false,
    ignore: [],
    only: [],
  }

  beforeEach(() => {
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(initializeDevServerSession).mockResolvedValue({
      storeFqdn: adminSession.storeFqdn,
      token: adminSession.token,
    } as any)
    vi.mocked(getAvailableTCPPort).mockResolvedValue(9292)
    vi.mocked(checkPortAvailability).mockResolvedValue(true)

    const backgroundJobPromise = new Promise<void>((resolve) => {
      resolveBackgroundJob = resolve
    })
    vi.mocked(setupDevServer).mockReturnValue({
      serverStart: vi.fn().mockResolvedValue(undefined),
      renderDevSetupProgress: vi.fn().mockResolvedValue(undefined),
      backgroundJobPromise,
      resolveBackgroundJob: resolveBackgroundJob!,
      dispatchEvent: vi.fn(),
    } as any)

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    exitSpy.mockRestore()
  })

  test('Ctrl-C path: reports analytics once, even if reportDevAnalytics is invoked again', async () => {
    const devPromise = dev(baseOptions)

    // Flush microtasks so the Promise.all is awaiting backgroundJobPromise.
    await new Promise((resolve) => setImmediate(resolve))

    // Simulate Ctrl-C by resolving the background job.
    resolveBackgroundJob()
    await devPromise

    expect(reportAnalyticsEvent).toHaveBeenCalledTimes(1)
    expect(reportAnalyticsEvent).toHaveBeenCalledWith({config: mockConfig, exitMode: 'ok'})

    expect(addPublicMetadata).toHaveBeenCalledTimes(1)
    const publicMetadataFn = vi.mocked(addPublicMetadata).mock.calls[0]![0] as () => Record<string, unknown>
    expect(publicMetadataFn()).toEqual({store_fqdn_hash: expect.any(String)})

    expect(addSensitiveMetadata).toHaveBeenCalledTimes(1)
    const sensitiveMetadataFn = vi.mocked(addSensitiveMetadata).mock.calls[0]![0] as () => Record<string, unknown>
    expect(sensitiveMetadataFn()).toEqual({store_fqdn: adminSession.storeFqdn})

    expect(exitSpy).toHaveBeenCalledWith(0)

    const reportOrder = vi.mocked(reportAnalyticsEvent).mock.invocationCallOrder[0]!
    const exitOrder = exitSpy.mock.invocationCallOrder[0]!
    expect(reportOrder).toBeLessThan(exitOrder)

    await reportDevAnalytics(mockConfig, adminSession as any)

    expect(reportAnalyticsEvent).toHaveBeenCalledTimes(1)
  })

  test('uses storefront host override for local rendering while keeping Admin host for editor URLs', async () => {
    const previewStoreOptions = {
      ...baseOptions,
      adminSession: {storeFqdn: 'preview-1780041822.dev-api.shop.dev', token: 'x'},
      store: 'preview-1780041822.dev-api.shop.dev',
      storefrontHost: 'preview-1780041822.my.shop.dev',
      previewUrl: 'https://preview.example.test',
    }

    vi.mocked(initializeDevServerSession).mockResolvedValueOnce({
      storeFqdn: previewStoreOptions.adminSession.storeFqdn,
      storefrontFqdn: 'preview-1780041822.my.shop.dev',
      token: previewStoreOptions.adminSession.token,
    } as any)

    const devPromise = dev(previewStoreOptions)
    await new Promise((resolve) => setImmediate(resolve))
    resolveBackgroundJob()
    await devPromise

    expect(initializeDevServerSession).toHaveBeenCalledWith(
      theme.id.toString(),
      expect.objectContaining({
        storeFqdn: 'preview-1780041822.dev-api.shop.dev',
        storefrontFqdn: 'preview-1780041822.my.shop.dev',
      }),
      undefined,
      undefined,
    )

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        nextSteps: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              link: expect.objectContaining({
                url: 'https://preview.example.test',
              }),
            }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({
              link: expect.objectContaining({
                url: `https://admin.shop.dev/store/preview-1780041822/themes/${theme.id}/editor?hr=9292`,
              }),
            }),
          ]),
        ]),
      }),
    )
  })
})
