import {showDeprecationWarnings, refreshTokens, dev, DevOptions} from './dev.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {mountThemeFileSystem} from '../utilities/theme-fs.js'
import {fakeThemeFileSystem} from '../utilities/theme-fs/theme-fs-mock-factory.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {DevServerSession} from '../utilities/theme-environment/types.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
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
    storefrontToken: 'my-storefront-token',
    directory: 'my-directory',
    store: 'my-store',
    theme: buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!,
    force: false,
    open: false,
    flagsToPass: [],
    password: 'my-token',
    'theme-editor-sync': false,
    legacy: true,
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

  describe('Ruby implementation', async () => {
    test('runs theme serve on CLI2 without passing a token when no password is used', async () => {
      // Given
      const devOptions = {...options, password: undefined}

      // When
      await dev(devOptions)

      // Then
      const expectedParams = ['theme', 'serve', 'my-directory']
      expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
        store: 'my-store',
        adminToken: undefined,
        storefrontToken: undefined,
      })
    })

    test('runs theme serve on CLI2 passing a token when a password is used', async () => {
      // Given
      const devOptions = {...options, password: 'my-token'}

      // When
      await dev(devOptions)

      // Then
      const expectedParams = ['theme', 'serve', 'my-directory']
      expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
        store: 'my-store',
        adminToken: 'my-token',
        storefrontToken: 'my-storefront-token',
      })
    })

    test("runs theme serve on CLI2 passing '--open' flag when it's true", async () => {
      // Given
      const devOptions = {...options, open: true}

      // When
      await dev(devOptions)

      // Then
      const expectedParams = ['theme', 'serve', 'my-directory', '--open']
      expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
        store: 'my-store',
        adminToken: 'my-token',
        storefrontToken: 'my-storefront-token',
      })
    })

    test("runs theme serve on CLI2 passing '--open' flag when it's false", async () => {
      // Given
      const devOptions = {...options, open: false}

      // When
      await dev(devOptions)

      // Then
      const expectedParams = ['theme', 'serve', 'my-directory']
      expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
        store: 'my-store',
        adminToken: 'my-token',
        storefrontToken: 'my-storefront-token',
      })
    })
  })
})

describe('showDeprecationWarnings', () => {
  test('does nothing when the -e flag includes a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', 'whatever'])

    // Then
    expect(outputMock.output()).toMatch('')
  })

  test('shows a warning message when the -e flag does not include a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })

  test('shows a warning message when the -e flag is followed by another flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', '--verbose'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })
})

describe('refreshTokens', () => {
  test('returns the admin session and storefront token', async () => {
    // When
    const result = await refreshTokens('my-store', 'my-password')

    // Then
    expect(result).toEqual({
      adminSession: {storeFqdn: 'my-store.myshopify.com', token: 'my-password'},
      storefrontToken: 'my-password',
    })
  })

  test('refreshes CLI2 cache with theme token command', async () => {
    // When
    await refreshTokens('my-store', 'my-password')

    // Then
    const expectedParams = ['theme', 'token', '--admin', 'my-password', '--sfr', 'my-password']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams)
  })
})
