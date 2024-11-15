import {dev, DevOptions, renderLinks} from './dev.js'
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
import {renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/theme-environment.js')
vi.mock('../utilities/theme-fs-empty.js')
vi.mock('../utilities/theme-fs.js')

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

  describe('renderLinks', async () => {
    test('renders "dev" command links', async () => {
      // Given
      const themeId = theme.id.toString()

      // When
      renderLinks(store, themeId)

      // Then
      expect(renderSuccess).toHaveBeenCalledWith({
        body: [
          {
            list: {
              items: ['http://127.0.0.1:9292'],
              title: {
                bold: 'Preview your theme',
              },
            },
          },
        ],
        nextSteps: [
          [
            {
              link: {
                label: 'Preview your gift cards',
                url: 'http://127.0.0.1:9292/gift_cards/[store_id]/preview',
              },
            },
          ],
          [
            {
              link: {
                label: 'Customize your theme at the theme editor',
                url: 'https://my-store.myshopify.com/admin/themes/123/editor',
              },
            },
          ],
          [
            'Share your theme preview',
            {
              subdued: '\nhttps://my-store.myshopify.com/?preview_theme_id=123',
            },
          ],
        ],
      })
    })
  })
})
