import {dev, DevOptions, openURLSafely, renderLinks} from './dev.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {mountThemeFileSystem} from '../utilities/theme-fs.js'
import {fakeThemeFileSystem} from '../utilities/theme-fs/theme-fs-mock-factory.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {DevServerSession} from '../utilities/theme-environment/types.js'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/theme-environment.js')
vi.mock('../utilities/theme-fs-empty.js')
vi.mock('../utilities/theme-fs.js')
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
  const adminSession = {storeFqdn: store, token: 'my-token'}
  const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!
  const options: DevOptions = {
    adminSession,
    directory: 'my-directory',
    store,
    theme,
    force: false,
    open: false,
    password: 'my-token',
    'theme-editor-sync': false,
    'live-reload': 'hot-reload',
    noDelete: false,
    ignore: [],
    only: [],
  }

  const session: DevServerSession = {
    ...adminSession,
    storefrontToken: 'token_111222333',
    storefrontPassword: 'password',
    sessionCookies: {
      storefront_digest: '00001111222233334444',
      _shopify_essential: ':00112233445566778899:',
    },
  }

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = fakeThemeFileSystem('tmp', new Map())

  describe('TS implementation', async () => {
    test('calls startDevServer with the correct arguments when the `legacy` option is false', async () => {
      // Given
      vi.mocked(initializeDevServerSession).mockResolvedValue(session)
      vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
      vi.mocked(ensureValidPassword).mockResolvedValue('valid-password')
      vi.mocked(fetchChecksums).mockResolvedValue([])
      vi.mocked(mountThemeFileSystem).mockReturnValue(localThemeFileSystem)
      vi.mocked(emptyThemeExtFileSystem).mockReturnValue(localThemeExtensionFileSystem)
      vi.mocked(setupDevServer).mockReturnValue({
        workPromise: Promise.resolve(),
        renderDevSetupProgress: () => Promise.resolve(),
        dispatchEvent: () => {},
        serverStart: async () => ({close: async () => {}}),
      })

      const devOptions = {...options, storePassword: 'wrong-password', legacy: false, 'theme-editor-sync': true}

      // When
      await dev(devOptions)

      // Then
      expect(setupDevServer).toHaveBeenCalledWith(options.theme, {
        session,
        localThemeFileSystem,
        localThemeExtensionFileSystem,
        directory: 'my-directory',
        options: {
          themeEditorSync: true,
          host: '127.0.0.1',
          liveReload: 'hot-reload',
          open: false,
          port: '9292',
          ignore: [],
          noDelete: false,
          only: [],
        },
      })
    })
  })

  test('renders "dev" command links', async () => {
    // Given
    const themeId = theme.id.toString()
    const host = '127.0.0.1'
    const port = '9292'
    const urls = {
      local: `http://${host}:${port}`,
      giftCard: `http://${host}:${port}/gift_cards/[store_id]/preview`,
      themeEditor: `https://${store}/admin/themes/${themeId}/editor`,
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
              url: `https://${store}/admin/themes/${themeId}/editor`,
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
})
