import {dev, DevOptions} from './dev.js'
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

vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/theme-environment.js')
vi.mock('../utilities/theme-fs-empty.js')
vi.mock('../utilities/theme-fs.js')

describe('dev', () => {
  const adminSession = {storeFqdn: 'my-store.myshopify.com', token: 'my-token'}
  const options: DevOptions = {
    adminSession,
    directory: 'my-directory',
    store: 'my-store',
    theme: buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!,
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
})
