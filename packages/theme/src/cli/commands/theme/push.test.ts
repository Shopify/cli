import Push, {ThemeSelectionOptions, createOrSelectTheme} from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {UnpublishedThemeManager} from '../../utilities/unpublished-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {push} from '../../services/push.js'
import {FilterProps} from '../../utilities/theme-selector/filter.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE, UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

vi.mock('../../services/push.js')
vi.mock('../../utilities/development-theme-manager.js')
vi.mock('../../utilities/unpublished-theme-manager.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')

describe('Push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  describe('run with CLI 3 implementation', () => {
    test('should run the CLI 2 implementation if the password flag is provided', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!

      // When
      await runPushCommand(['--password', '123'], path, adminSession, theme)

      // Then
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --development-theme-id ${theme.id}`)
    })

    test('should pass call the CLI 3 command', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

      // When
      await runPushCommand([], path, adminSession)

      // Then
      expect(execCLI2).not.toHaveBeenCalled()
      expect(push).toHaveBeenCalled()
    })
  })

  describe('createOrSelectTheme', async () => {
    beforeEach(() => {
      vi.mocked(DevelopmentThemeManager.prototype.findOrCreate).mockResolvedValue(
        buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!,
      )
      vi.mocked(UnpublishedThemeManager.prototype.create).mockResolvedValue(
        buildTheme({id: 2, name: 'Unpublished Theme', role: UNPUBLISHED_THEME_ROLE})!,
      )
      vi.mocked(findOrSelectTheme).mockImplementation(
        async (_session: AdminSession, options: {header?: string; filter: FilterProps}) => {
          if (options.filter.live) {
            return buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!
          } else if (options.filter.theme) {
            return buildTheme({id: 4, name: options.filter.theme, role: DEVELOPMENT_THEME_ROLE})!
          } else {
            return buildTheme({id: 5, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
          }
        },
      )
    })

    test('creates unpublished theme when unpublished flag is provided', async () => {
      // Given
      const flags: ThemeSelectionOptions = {unpublished: true}
      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme).toMatchObject({role: UNPUBLISHED_THEME_ROLE})
      expect(UnpublishedThemeManager.prototype.create).toHaveBeenCalled()
    })

    test('creates development theme when development flag is provided', async () => {
      // Given
      const flags: ThemeSelectionOptions = {development: true}
      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalled()
    })

    test('returns live theme when live flag is provided', async () => {
      // Given
      const flags: ThemeSelectionOptions = {live: true, 'allow-live': true}

      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme).toMatchObject({role: LIVE_THEME_ROLE})
    })

    test('creates development theme when development and unpublished flags are provided', async () => {
      // Given
      const flags: ThemeSelectionOptions = {development: true, unpublished: true}

      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
    })

    test("renders confirmation prompt if 'allow-live' flag is not provided and selected theme role is live", async () => {
      // Given
      const flags: ThemeSelectionOptions = {live: true}
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme?.role).toBe(LIVE_THEME_ROLE)
      expect(renderConfirmationPrompt).toHaveBeenCalled()
    })

    test("renders confirmation prompt if 'allow-live' flag is not provided and live theme is specified via theme flag", async () => {
      // Given
      const flags: ThemeSelectionOptions = {theme: '3'}
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme?.role).toBe(LIVE_THEME_ROLE)
      expect(renderConfirmationPrompt).toHaveBeenCalled()
    })

    test('returns undefined if live theme confirmation prompt is not confirmed', async () => {
      // Given
      const flags: ThemeSelectionOptions = {live: true}
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

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
      expect(renderTextPrompt).toHaveBeenCalled()
    })

    test('returns undefined if confirmation prompt is rejected', async () => {
      // Given
      const flags = {live: true}

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

      // When
      const theme = await createOrSelectTheme(adminSession, flags)

      // Then
      expect(theme).toBeUndefined()
    })
  })

  describe('run with CLI 2 implementation', () => {
    test('should pass development theme from local storage to CLI 2', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      await run([], theme)

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --stable --development-theme-id ${theme.id}`)
    })

    test('should pass theme and development theme from local storage to CLI 2', async () => {
      // Given
      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      await run([`--theme=${themeId}`], theme)

      // Then
      expectCLI2ToHaveBeenCalledWith(
        `theme push ${path} --theme ${themeId} --stable --development-theme-id ${theme.id}`,
      )
    })

    test('should not pass development theme to CLI 2 if local storage is empty', async () => {
      // When
      await run([])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --stable`)
    })

    test('should pass theme and development theme to CLI 2', async () => {
      // Given
      const theme = buildTheme({id: 4, name: 'Theme', role: 'development'})!
      await run(['--development'], theme)

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(
        `theme push ${path} --stable --theme ${theme.id} --development-theme-id ${theme.id}`,
      )
    })
  })

  async function run(argv: string[], theme?: Theme) {
    await runPushCommand(['--stable', ...argv], path, adminSession, theme)
  }

  function expectCLI2ToHaveBeenCalledWith(command: string) {
    expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
      store: 'example.myshopify.com',
      adminToken: adminSession.token,
    })
  }

  async function runPushCommand(argv: string[], path: string, adminSession: AdminSession, theme?: Theme) {
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    if (theme) {
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
    }
    vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)

    const config = {} as Config
    const push = new Push([`--path=${path}`, ...argv], config)

    await push.run()
  }
})
