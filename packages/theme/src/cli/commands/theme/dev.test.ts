import Dev from './dev.js'
import {dev} from '../../services/dev.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureLiveThemeConfirmed} from '../../utilities/theme-ui.js'
import {metafieldsPull} from '../../services/metafields-pull.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Config} from '@oclif/core'
import {describe, vi, expect, test, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('../../services/dev.js')
vi.mock('../../services/dev-override.js')
vi.mock('../../utilities/development-theme-manager.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-ui.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-store.js')

const CommandConfig = new Config({root: __dirname})

const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
const devTheme = buildTheme({id: 1, name: 'Dev Theme', role: DEVELOPMENT_THEME_ROLE})!
const namedTheme = buildTheme({id: 2, name: 'My Theme', role: 'unpublished'})!

async function run(argv: string[]) {
  await CommandConfig.load()
  const command = new Dev(['--store=test-store.myshopify.com', '--path=/theme', ...argv], CommandConfig)
  await command.run()
}

describe('Dev', () => {
  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockReturnValue('test-store.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
    vi.mocked(metafieldsPull).mockResolvedValue(undefined)
    vi.mocked(dev).mockResolvedValue(undefined)
    vi.mocked(DevelopmentThemeManager).mockImplementation(
      () =>
        ({
          findOrCreate: vi.fn().mockResolvedValue({...devTheme, createdAtRuntime: false}),
        } as any),
    )
  })

  describe('--overrides flag', () => {
    test('calls devWithOverrideFile when --overrides and --theme are provided', async () => {
      // Given
      vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
      vi.mocked(devWithOverrideFile).mockResolvedValue(undefined)

      // When
      await run(['--overrides=/path/to/overrides.json', '--theme=My Theme'])

      // Then
      expect(devWithOverrideFile).toHaveBeenCalledWith(
        expect.objectContaining({
          adminSession,
          overrideJson: '/path/to/overrides.json',
          themeId: namedTheme.id.toString(),
          open: false,
        }),
      )
      expect(dev).not.toHaveBeenCalled()
    })

    test('passes --preview-id to devWithOverrideFile when provided', async () => {
      // Given
      vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
      vi.mocked(devWithOverrideFile).mockResolvedValue(undefined)

      // When
      await run(['--overrides=/path/to/overrides.json', '--theme=My Theme', '--preview-id=abc123'])

      // Then
      expect(devWithOverrideFile).toHaveBeenCalledWith(
        expect.objectContaining({
          previewIdentifier: 'abc123',
        }),
      )
    })

    test('throws AbortError when --overrides is used without --theme', async () => {
      // When/Then
      await expect(run(['--overrides=/path/to/overrides.json'])).rejects.toThrow(
        'The --theme flag is required when using --overrides.',
      )
      expect(devWithOverrideFile).not.toHaveBeenCalled()
    })

    test('does not run normal dev flow when --overrides is provided', async () => {
      // Given
      vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
      vi.mocked(devWithOverrideFile).mockResolvedValue(undefined)

      // When
      await run(['--overrides=/path/to/overrides.json', '--theme=My Theme'])

      // Then
      expect(dev).not.toHaveBeenCalled()
    })
  })

  describe('normal dev flow', () => {
    test('creates a development theme when no --theme flag is provided', async () => {
      // When
      await run([])

      // Then
      expect(DevelopmentThemeManager).toHaveBeenCalledWith(adminSession)
      expect(dev).toHaveBeenCalledWith(
        expect.objectContaining({
          directory: '/theme',
          theme: devTheme,
        }),
      )
    })

    test('finds the specified theme when --theme flag is provided', async () => {
      // Given
      vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)

      // When
      await run(['--theme=My Theme'])

      // Then
      expect(findOrSelectTheme).toHaveBeenCalledWith(adminSession, {filter: {theme: 'My Theme'}})
      expect(dev).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: namedTheme,
        }),
      )
    })

    test('runs metafieldsPull after dev', async () => {
      // When
      await run([])

      // Then
      expect(metafieldsPull).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/theme',
        }),
      )
    })

    test('returns early when live theme is not confirmed', async () => {
      // Given
      vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(false)

      // When
      await run([])

      // Then
      expect(dev).not.toHaveBeenCalled()
    })
  })
})
