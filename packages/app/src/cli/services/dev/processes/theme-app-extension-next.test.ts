import {setupPreviewThemeAppExtensionsProcess, findOrCreateHostTheme} from './theme-app-extension-next.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AdminSession, ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {vi, describe, test, expect, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../../../utilities/host-theme-manager')
vi.mock('@shopify/cli-kit/node/output')

describe('setupPreviewThemeAppExtensionsProcess', () => {
  const mockAdminSession = {storeFqdn: 'test.myshopify.com'} as any as AdminSession
  const mockDeveloperPlatformClient = {} as DeveloperPlatformClient
  const mockThemeExtension = {isThemeExtension: true} as ExtensionInstance

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
  })

  test('Returns undefined if no theme extensions are present', async () => {
    // Given
    const allExtensions: ExtensionInstance[] = []
    const storeFqdn = 'test.myshopify.com'
    const developerPlatformClient = mockDeveloperPlatformClient

    // When
    const result = await setupPreviewThemeAppExtensionsProcess({
      allExtensions,
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

    const allExtensions = [mockThemeExtension]
    const storeFqdn = 'test.myshopify.com'
    const theme = '123'
    const developerPlatformClient = mockDeveloperPlatformClient

    // When
    const result = await setupPreviewThemeAppExtensionsProcess({
      allExtensions,
      storeFqdn,
      theme,
      developerPlatformClient,
    })

    // Then
    expect(result).toBeDefined()
    expect(result?.options.themeId).toBe('123')
  })
})

describe('findOrCreateHostTheme', () => {
  const mockAdminSession = {storeFqdn: 'test.myshopify.com'} as any as AdminSession

  test('Returns theme id if theme is provided and found', async () => {
    // Given
    const mockTheme = {id: 123} as Theme
    vi.mocked(fetchTheme).mockResolvedValue(mockTheme)
    const theme = '123'

    // When
    const result = await findOrCreateHostTheme(mockAdminSession, theme)

    // Then
    expect(result).toBe('123')
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
    const result = await findOrCreateHostTheme(mockAdminSession)

    // Then
    expect(result).toBe('123')
  })

  test('Throws error if findOrCreateHostTheme fails', async () => {
    // Given
    vi.mocked(HostThemeManager.prototype.findOrCreate).mockRejectedValue(new Error('error'))

    // When
    // Then
    await expect(findOrCreateHostTheme(mockAdminSession)).rejects.toThrow(Error)
  })
})
