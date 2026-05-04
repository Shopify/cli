import {devWithOverrideFile} from './dev-override.js'
import {openURLSafely} from './dev.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {startMockShopPreviewSession} from '../utilities/theme-previews/mock-shop.js'
import {describe, expect, test, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {collectedLogs, clearCollectedLogs} from '@shopify/cli-kit/node/output'
import {fileExistsSync, readFile} from '@shopify/cli-kit/node/fs'

vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-previews/preview.js')
vi.mock('../utilities/theme-previews/mock-shop.js')
vi.mock('./dev.js', () => ({openURLSafely: vi.fn()}))
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/fs')

const adminSession = {token: 'token', storeFqdn: 'store.myshopify.com'}
const mockSession = {
  token: 'token',
  storeFqdn: 'store.myshopify.com',
  storefrontToken: 'sf_token',
  sessionCookies: {},
}
const expectedPreviewUrl = 'https://abc123.shopifypreview.com'
const expectedPreviewId = 'abc123'
const mockShopLauncherUrl = 'file:///tmp/mock-shop-preview.html'
const mockShopTargetUrl = 'https://demostore.mock.shop/?theme_preview'
const customMockShopTargetUrl = 'http://localhost:3000/?theme_preview'

describe('devWithOverrideFile', () => {
  test('throws when override file does not exist', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(false)

    // When/Then
    await expect(
      devWithOverrideFile({adminSession, overrideJson: '/missing.json', themeId: '123', open: false}),
    ).rejects.toThrow('Override file not found: /missing.json')
  })

  test('creates a preview when no previewIdentifier is provided', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
    const expectedThemeId = '789'

    // When
    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', themeId: expectedThemeId, open: false})

    // Then
    expect(fetchDevServerSession).toHaveBeenCalledWith(expectedThemeId, adminSession, undefined)

    // Then
    expect(createThemePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        session: mockSession,
        themeId: expectedThemeId,
      }),
    )
    expect(updateThemePreview).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          {
            list: {
              title: 'Preview is ready',
              items: [{link: {url: expectedPreviewUrl}}, `Preview ID: ${expectedPreviewId}`],
            },
          },
        ],
      }),
    )
  })

  test('updates a preview when previewIdentifier is provided', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(updateThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
    const expectedThemeId = '789'

    // When
    await devWithOverrideFile({
      adminSession,
      overrideJson: '/overrides.json',
      themeId: expectedThemeId,
      previewIdentifier: expectedPreviewId,
      open: false,
      json: false,
    })

    // Then
    expect(updateThemePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        session: mockSession,
        themeId: expectedThemeId,
        previewIdentifier: expectedPreviewId,
      }),
    )
    expect(createThemePreview).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          {
            list: {
              title: 'Preview updated',
              items: [{link: {url: expectedPreviewUrl}}, `Preview ID: ${expectedPreviewId}`],
            },
          },
        ],
      }),
    )
  })

  test('throws when override file contains invalid JSON', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from('not valid json'))

    // When/Then
    const error = await devWithOverrideFile({
      adminSession,
      overrideJson: '/bad.json',
      themeId: '123',
      open: false,
      json: false,
    }).catch((err) => err)
    expect(error.message).toBe('Failed to parse override file: /bad.json')
    expect(error.tryMessage).toMatch(/not valid json/i)
  })

  test('opens the preview URL when open is true', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})

    // When
    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', themeId: '789', open: true})

    // Then
    expect(openURLSafely).toHaveBeenCalledWith(expectedPreviewUrl, 'theme preview')
  })

  test('does not open the preview URL when open is false', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})

    // When
    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', themeId: '789', open: false})

    // Then
    expect(openURLSafely).not.toHaveBeenCalled()
  })

  test('passes password to fetchDevServerSession when provided', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})

    // When
    await devWithOverrideFile({
      adminSession,
      overrideJson: '/overrides.json',
      themeId: '789',
      open: false,
      json: false,
      password: 'shptka_abc123',
    })

    // Then
    expect(fetchDevServerSession).toHaveBeenCalledWith('789', adminSession, 'shptka_abc123')
  })

  test('outputs JSON when json flag is true', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
    clearCollectedLogs()

    // When
    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', themeId: '789', open: false, json: true})

    // Then
    const expectedJson = JSON.stringify({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
    expect(collectedLogs.info).toContainEqual(expectedJson)
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success body by default when json flag is omitted', async () => {
    // Given
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
    vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
    clearCollectedLogs()

    // When
    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', themeId: '789', open: false})

    // Then
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('starts a one-shot mock.shop preview when mockShop is enabled', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(startMockShopPreviewSession).mockResolvedValue({
      launcherUrl: mockShopLauncherUrl,
      targetUrl: mockShopTargetUrl,
      completion: Promise.resolve(),
    })

    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', open: false, mockShop: true})

    expect(startMockShopPreviewSession).toHaveBeenCalledWith(JSON.stringify({templates: {}}), {
      storefrontUrl: undefined,
    })
    expect(fetchDevServerSession).not.toHaveBeenCalled()
    expect(createThemePreview).not.toHaveBeenCalled()
    expect(updateThemePreview).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          {
            list: {
              title: 'Mock.shop preview is ready',
              items: [{link: {url: mockShopLauncherUrl}}, `Target: ${mockShopTargetUrl}`, 'This prototype opens an initial preview only.'],
            },
          },
        ],
      }),
    )
  })

  test('opens the launcher URL for a mock.shop preview', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(startMockShopPreviewSession).mockResolvedValue({
      launcherUrl: mockShopLauncherUrl,
      targetUrl: mockShopTargetUrl,
      completion: Promise.resolve(),
    })

    await devWithOverrideFile({adminSession, overrideJson: '/overrides.json', open: true, mockShop: true})

    expect(openURLSafely).toHaveBeenCalledWith(mockShopLauncherUrl, 'mock.shop preview')
  })

  test('passes through a custom storefront URL in mock.shop mode', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))
    vi.mocked(startMockShopPreviewSession).mockResolvedValue({
      launcherUrl: mockShopLauncherUrl,
      targetUrl: customMockShopTargetUrl,
      completion: Promise.resolve(),
    })

    await devWithOverrideFile({
      adminSession,
      overrideJson: '/overrides.json',
      open: false,
      mockShop: true,
      mockShopStorefrontUrl: 'http://localhost:3000',
    })

    expect(startMockShopPreviewSession).toHaveBeenCalledWith(JSON.stringify({templates: {}}), {
      storefrontUrl: 'http://localhost:3000',
    })
  })

  test('rejects preview IDs in mock.shop mode', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({templates: {}})))

    await expect(
      devWithOverrideFile({
        adminSession,
        overrideJson: '/overrides.json',
        open: false,
        mockShop: true,
        previewIdentifier: 'abc123',
      }),
    ).rejects.toThrow('The --preview-id flag is not supported with --mock-shop.')
  })
})
