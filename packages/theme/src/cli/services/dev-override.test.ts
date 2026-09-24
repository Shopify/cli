import {devWithOverrideFile} from './dev-override.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {describe, expect, test, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('../utilities/theme-environment/dev-server-session.js')
vi.mock('../utilities/theme-previews/preview.js')
vi.mock('@shopify/cli-kit/node/ui')

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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const overrideJson = joinPath(tmpDir, 'missing.json')

      // When/Then
      await expect(devWithOverrideFile({adminSession, overrideJson, themeId: '123'})).rejects.toThrow(
        `Override file not found: ${overrideJson}`,
      )
    })
  })

  test('creates a preview when no previewIdentifier is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const overrideJson = joinPath(tmpDir, 'overrides.json')
      await writeFile(overrideJson, JSON.stringify({templates: {}}))
      vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
      vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
      const expectedThemeId = '789'

      // When
      const result = await devWithOverrideFile({adminSession, overrideJson, themeId: expectedThemeId})

      // Then
      expect(fetchDevServerSession).toHaveBeenCalledWith(expectedThemeId, adminSession, undefined)

      // Then
      expect(createThemePreview).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          themeId: expectedThemeId,
          overridesContent: JSON.stringify({templates: {}}),
        }),
      )
      expect(updateThemePreview).not.toHaveBeenCalled()
      expect(result).toEqual({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('updates a preview when previewIdentifier is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const overrideJson = joinPath(tmpDir, 'overrides.json')
      await writeFile(overrideJson, JSON.stringify({templates: {}}))
      vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
      vi.mocked(updateThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
      const expectedThemeId = '789'

      // When
      const result = await devWithOverrideFile({
        adminSession,
        overrideJson,
        themeId: expectedThemeId,
        previewIdentifier: expectedPreviewId,
      })

      // Then
      expect(updateThemePreview).toHaveBeenCalledWith(
        expect.objectContaining({
          session: mockSession,
          themeId: expectedThemeId,
          overridesContent: JSON.stringify({templates: {}}),
          previewIdentifier: expectedPreviewId,
        }),
      )
      expect(createThemePreview).not.toHaveBeenCalled()
      expect(result).toEqual({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('throws when override file contains invalid JSON', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const overrideJson = joinPath(tmpDir, 'bad.json')
      await writeFile(overrideJson, 'not valid json')

      // When/Then
      const error = await devWithOverrideFile({
        adminSession,
        overrideJson,
        themeId: '123',
      }).catch((err) => err)
      expect(error.message).toBe(`Failed to parse override file: ${overrideJson}`)
      expect(error.tryMessage).toMatch(/not valid json/i)
    })
  })

  test('passes password to fetchDevServerSession when provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const overrideJson = joinPath(tmpDir, 'overrides.json')
      await writeFile(overrideJson, JSON.stringify({templates: {}}))
      vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
      vi.mocked(createThemePreview).mockResolvedValue({url: expectedPreviewUrl, preview_identifier: expectedPreviewId})

      // When
      await devWithOverrideFile({
        adminSession,
        overrideJson,
        themeId: '789',
        password: 'shptka_abc123',
      })

      // Then
      expect(fetchDevServerSession).toHaveBeenCalledWith('789', adminSession, 'shptka_abc123')
    })
  })

  test.each([undefined, 'existing-preview'])('propagates API failures for preview %s', async (previewIdentifier) => {
    await inTemporaryDirectory(async (tmpDir) => {
      const overrideJson = joinPath(tmpDir, 'overrides.json')
      await writeFile(overrideJson, '{}')
      vi.mocked(fetchDevServerSession).mockResolvedValue(mockSession)
      const error = new Error('Theme preview request failed')
      vi.mocked(createThemePreview).mockRejectedValue(error)
      vi.mocked(updateThemePreview).mockRejectedValue(error)

      await expect(devWithOverrideFile({adminSession, overrideJson, themeId: '123', previewIdentifier})).rejects.toBe(
        error,
      )
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })
})
