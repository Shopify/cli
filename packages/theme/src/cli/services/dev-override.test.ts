import {devWithOverrideFile} from './dev-override.js'
import {openURLSafely} from './dev.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {describe, expect, test, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExistsSync, readFile} from '@shopify/cli-kit/node/fs'

vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-previews/preview.js')
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
    expect(createThemePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        session: mockSession,
        storefrontToken: 'sf_token',
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
    const expectedThemeId = '789';

    // When
    await devWithOverrideFile({
      adminSession,
      overrideJson: '/overrides.json',
      themeId: expectedThemeId,
      previewIdentifier: expectedPreviewId,
      open: false,
    })

    // Then
    expect(updateThemePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        session: mockSession,
        storefrontToken: 'sf_token',
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
})
