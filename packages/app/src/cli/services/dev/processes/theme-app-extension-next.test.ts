import {setupPreviewThemeAppExtensionsProcess, findOrCreateHostTheme} from './theme-app-extension-next.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {HostThemeManager} from '../../../utilities/extensions/theme/host-theme-manager.js'
import {testApp, testOrganizationApp, testThemeExtensions} from '../../../models/app/app.test-data.js'
import {AdminSession, ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {vi, describe, test, expect, beforeEach} from 'vitest'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('../../../utilities/extensions/theme/host-theme-manager')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui', async (realImport) => {
  const realModule = await realImport<typeof import('@shopify/cli-kit/node/ui')>()
  const mockModule = {renderInfo: vi.fn()}

  return {...realModule, ...mockModule}
})

describe('setupPreviewThemeAppExtensionsProcess', () => {
  const mockAdminSession = {storeFqdn: 'test.myshopify.com'} as any as AdminSession
  const mockDeveloperPlatformClient = {} as DeveloperPlatformClient

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
  })

  test('Returns undefined if no theme extensions are present', async () => {
    // Given
    const localApp = testApp()
    const remoteApp = testOrganizationApp()
    const storeFqdn = 'test.myshopify.com'
    const developerPlatformClient = mockDeveloperPlatformClient

    // When
    const result = await setupPreviewThemeAppExtensionsProcess({
      localApp,
      remoteApp,
      storeFqdn,
      developerPlatformClient,
    })

    // Then
    expect(result).toBeUndefined()
  })

  test('Returns PreviewThemeAppExtensionsOptions if theme extensions are present', async () => {
    // Given
    const mockTheme = {id: 123} as Theme
    vi.mocked(fetchTheme).mockResolvedValue(mockTheme)

    const storeFqdn = 'test.myshopify.com'
    const theme = '123'
    const developerPlatformClient = mockDeveloperPlatformClient
    const remoteApp = testOrganizationApp()
    const localApp = testApp({allExtensions: [await testThemeExtensions()]})

    // When
    const result = await setupPreviewThemeAppExtensionsProcess({
      localApp,
      remoteApp,
      storeFqdn,
      theme,
      developerPlatformClient,
    })

    // Then
    expect(result).toBeDefined()
    expect(result?.options.developerPlatformClient).toBe(developerPlatformClient)
    expect(renderInfo).toBeCalledWith({
      headline: 'The theme app extension development server is ready.',
      nextSteps: [
        [
          {
            link: {
              label: 'Install your app in your development store',
              url: 'https://partners.shopify.com/1/apps/1/test',
            },
          },
        ],
        [
          {
            link: {
              label: 'Setup your theme app extension in the host theme',
              url: 'https://test.myshopify.com/admin/themes/123/editor',
            },
          },
        ],
        [
          'Preview your theme app extension at',
          {
            link: {
              label: 'http://127.0.0.1:9293',
              url: 'http://127.0.0.1:9293',
            },
          },
        ],
      ],
      orderedNextSteps: true,
    })
  })
})

describe('findOrCreateHostTheme', () => {
  const mockAdminSession = {storeFqdn: 'test.myshopify.com'} as any as AdminSession

  test('Returns theme id if theme is provided and found', async () => {
    // Given
    const mockTheme = {id: 123} as Theme
    vi.mocked(fetchTheme).mockResolvedValue(mockTheme)

    // When
    const theme = await findOrCreateHostTheme(mockAdminSession, '123')
    const themeId = theme.id.toString()

    // Then
    expect(themeId).toBe('123')
    expect(HostThemeManager).not.toHaveBeenCalled()
  })

  test('Throws error if theme is provided and not found', async () => {
    // Given
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    const theme = '123'

    // When
    await expect(findOrCreateHostTheme(mockAdminSession, theme)).rejects.toThrow(AbortError)

    // Then
    expect(HostThemeManager).not.toHaveBeenCalled()
  })

  test('Returns new theme id if theme is not provided', async () => {
    // Given
    const mockTheme = {id: 123} as Theme
    vi.mocked(HostThemeManager.prototype.findOrCreate).mockResolvedValue(mockTheme)

    // When
    const theme = await findOrCreateHostTheme(mockAdminSession)
    const themeId = theme.id.toString()

    // Then
    expect(themeId).toBe('123')
  })

  test('Throws error if findOrCreateHostTheme fails', async () => {
    // Given
    vi.mocked(HostThemeManager.prototype.findOrCreate).mockRejectedValue(new Error('error'))

    // When
    // Then
    await expect(findOrCreateHostTheme(mockAdminSession)).rejects.toThrow(Error)
  })
})
