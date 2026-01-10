import {createOrSelectTheme, push, PushFlags} from './push.js'
import {PullFlags} from './pull.js'
import {setDevelopmentTheme} from './local-storage.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {runThemeCheck} from '../commands/theme/check.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi, expect, beforeEach} from 'vitest'
import {themeCreate, fetchTheme, themePublish} from '@shopify/cli-kit/node/themes/api'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {
  DEVELOPMENT_THEME_ROLE,
  LIVE_THEME_ROLE,
  promptThemeName,
  UNPUBLISHED_THEME_ROLE,
} from '@shopify/cli-kit/node/themes/utils'
import {renderConfirmationPrompt, renderError} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Severity, SourceCodeType} from '@shopify/theme-check-node'
import {outputResult} from '@shopify/cli-kit/node/output'

vi.mock('../utilities/theme-uploader.js')
vi.mock('../utilities/theme-store.js')
vi.mock('../utilities/theme-selector.js')
vi.mock('./local-storage.js')
vi.mock('@shopify/cli-kit/node/themes/utils')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../commands/theme/check.js')
vi.mock('@shopify/cli-kit/node/output')

const path = '/my-theme'
const defaultFlags: PullFlags = {
  path,
  development: false,
  live: false,
  nodelete: false,
  only: [],
  ignore: [],
  force: false,
}
const adminSession = {token: '', storeFqdn: ''}

describe('push', () => {
  beforeEach(() => {
    vi.mocked(uploadTheme).mockReturnValue({
      workPromise: Promise.resolve(),
      uploadResults: new Map(),
      renderThemeSyncProgress: () => Promise.resolve(),
      syncRewrittenFilesPromise: Promise.resolve(),
    })
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(outputResult).mockReturnValue()
  })

  test('should call themePublish if publish flag is provided', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await push({...defaultFlags, publish: true}, adminSession)

    // Then
    expect(themePublish).toHaveBeenCalledWith(theme.id, adminSession)
  })

  test('includes errors in JSON output when using --json flag', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    const uploadResults = new Map()
    uploadResults.set('assets/theme.css', {
      success: false,
      errors: {
        asset: ['Invalid CSS syntax at line 42'],
      },
    })
    uploadResults.set('layout/theme.liquid', {
      success: false,
      errors: {
        asset: ['Missing endif tag'],
      },
    })
    uploadResults.set('assets/valid.js', {
      success: true,
    })

    vi.mocked(uploadTheme).mockReturnValue({
      workPromise: Promise.resolve(),
      uploadResults,
      renderThemeSyncProgress: () => Promise.resolve(),
      syncRewrittenFilesPromise: Promise.resolve(),
    })

    // When
    await push({...defaultFlags, json: true}, adminSession)

    // Then
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify({
        theme: {
          id: 1,
          name: 'Theme',
          role: 'development',
          shop: '',
          editor_url: 'https:///admin/themes/1/editor',
          preview_url: 'https://?preview_theme_id=1',
          warning: "The theme 'Theme' was pushed with errors",
          errors: {
            'assets/theme.css': ['Invalid CSS syntax at line 42'],
            'layout/theme.liquid': ['Missing endif tag'],
          },
        },
      }),
    )
  })

  describe('strict mode', () => {
    beforeEach(() => {
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    })

    test('skips theme check when strict mode is disabled', async () => {
      // Given
      const flags = {...defaultFlags, strict: false}

      // When
      await push(flags, adminSession)

      // Then
      expect(runThemeCheck).not.toHaveBeenCalled()
    })

    test('blocks push when errors exist', async () => {
      // Given
      vi.mocked(runThemeCheck).mockResolvedValue({
        offenses: [
          {
            severity: Severity.ERROR,
            message: 'error message',
            type: SourceCodeType.LiquidHtml,
            check: 'check',
            uri: 'file:///path/to/file.liquid',
            start: {index: 0, line: 1, character: 1},
            end: {index: 1, line: 1, character: 1},
          },
        ],
        theme: [],
      })

      // When/Then
      await expect(push({...defaultFlags, strict: true}, adminSession)).rejects.toThrow(AbortError)
    })

    test('blocks push when both warnings and errors exist', async () => {
      // Given
      vi.mocked(runThemeCheck).mockResolvedValue({
        offenses: [
          {
            severity: Severity.WARNING,
            message: 'warning message',
            type: SourceCodeType.LiquidHtml,
            check: 'check',
            uri: 'file:///path/to/file.liquid',
            start: {index: 0, line: 1, character: 1},
            end: {index: 1, line: 1, character: 1},
          },
          {
            severity: Severity.ERROR,
            message: 'error message',
            type: SourceCodeType.LiquidHtml,
            check: 'check',
            uri: 'file:///path/to/file.liquid',
            start: {index: 0, line: 1, character: 1},
            end: {index: 1, line: 1, character: 1},
          },
        ],
        theme: [],
      })

      // When/Then
      await expect(push({...defaultFlags, strict: true}, adminSession)).rejects.toThrow(AbortError)
    })

    test('continues push when no offenses exist', async () => {
      // Given
      vi.mocked(runThemeCheck).mockResolvedValue({
        offenses: [],
        theme: [],
      })

      // When/Then
      await expect(push({...defaultFlags, strict: true}, adminSession)).resolves.not.toThrow()
    })

    test('continues push when only warnings exist', async () => {
      // Given
      vi.mocked(runThemeCheck).mockResolvedValue({
        offenses: [
          {
            severity: Severity.WARNING,
            message: 'warning message',
            check: 'check',
            uri: 'file:///path/to/file.liquid',
            type: SourceCodeType.LiquidHtml,
            start: {index: 0, line: 1, character: 1},
            end: {index: 1, line: 1, character: 1},
          },
        ],
        theme: [],
      })

      // When/Then
      await expect(push({...defaultFlags, strict: true}, adminSession)).resolves.not.toThrow()
    })

    test('passes the --json flag to theme check as output format', async () => {
      // Given
      vi.mocked(runThemeCheck).mockResolvedValue({
        offenses: [
          {
            severity: Severity.WARNING,
            message: 'warning message',
            check: 'check',
            uri: 'file:///path/to/file.liquid',
            type: SourceCodeType.LiquidHtml,
            start: {index: 0, line: 1, character: 1},
            end: {index: 1, line: 1, character: 1},
          },
        ],
        theme: [],
      })

      // When/Then
      await push({...defaultFlags, strict: true, json: true}, adminSession)
      expect(runThemeCheck).toHaveBeenCalledWith(path, 'json')
    })
  })
})

describe('createOrSelectTheme', async () => {
  test('creates unpublished theme when unpublished flag is provided', async () => {
    // Given
    vi.mocked(themeCreate).mockResolvedValue(buildTheme({id: 2, name: 'Theme', role: UNPUBLISHED_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)

    const flags: PushFlags = {unpublished: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: UNPUBLISHED_THEME_ROLE})
    expect(setDevelopmentTheme).not.toHaveBeenCalled()
  })

  test('creates development theme when development flag is provided', async () => {
    // Given
    vi.mocked(themeCreate).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    const flags: PushFlags = {development: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
    expect(setDevelopmentTheme).toHaveBeenCalled()
  })

  test('creates development theme when development and unpublished flags are provided', async () => {
    // Given
    vi.mocked(themeCreate).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    const flags: PushFlags = {development: true, unpublished: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
  })

  test('returns live theme when live flag is provided', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    const flags: PushFlags = {live: true, allowLive: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: LIVE_THEME_ROLE})
  })

  test('renders confirmation prompt if allowLive flag is not provided and selected theme role is live', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const flags: PushFlags = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme?.role).toBe(LIVE_THEME_ROLE)
    expect(renderConfirmationPrompt).toHaveBeenCalled()
  })

  test("renders confirmation prompt if 'allow-live' flag is not provided and live theme is specified via theme flag", async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const flags: PushFlags = {theme: '3'}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme?.role).toBe(LIVE_THEME_ROLE)
    expect(renderConfirmationPrompt).toHaveBeenCalled()
  })

  test('returns undefined if live theme confirmation prompt is not confirmed', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const flags: PushFlags = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toBeUndefined()
  })

  test('returns undefined if confirmation prompt is rejected', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const flags = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toBeUndefined()
  })

  test('renders text prompt if unpublished flag is provided and theme flag is not provided', async () => {
    // Given
    const flags = {unpublished: true}

    // When
    await createOrSelectTheme(adminSession, flags)

    // Then
    expect(promptThemeName).toHaveBeenCalledWith('Name of the new theme')
  })

  describe('when run during a multi environment command', () => {
    test('displays error when live theme is selected without allow-live flag', async () => {
      // Given
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
      const flags: PushFlags = {live: true, environment: ['production']}

      // When
      const theme = await createOrSelectTheme(adminSession, flags, true)

      // Then
      expect(theme).toBeUndefined()
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Environment: production',
        body: [
          `Can't push theme files to the live theme on ${adminSession.storeFqdn}`,
          'Use the --allow-live flag to push to a live theme.',
        ],
      })
    })
  })
})
