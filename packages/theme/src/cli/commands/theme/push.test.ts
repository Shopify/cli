import Push from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {push} from '../../services/push.js'
import {describe, vi, expect, test} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('../../services/push.js')
vi.mock('../../utilities/development-theme-manager.js')
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

    test('should pass theme selection flags to FindOrSelectTheme', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

      // When
      await runPushCommand(['--live', '--development', '-t', '1'], path, adminSession)

      // Then
      expect(findOrSelectTheme).toHaveBeenCalledWith(adminSession, {
        header: 'Select a theme to push to:',
        filter: {
          live: true,
          development: true,
          theme: '1',
        },
      })
    })

    test('should create an unpublished theme when the `unpublished` flag is provided', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(DevelopmentThemeManager.prototype.create).mockResolvedValue(theme)

      // When
      await runPushCommand(['--unpublished', '--theme', 'test_theme'], path, adminSession)

      // Then
      expect(DevelopmentThemeManager.prototype.create).toHaveBeenCalledWith('unpublished', 'test_theme')
      expect(findOrSelectTheme).not.toHaveBeenCalled()
    })

    test("should render confirmation prompt if 'allow-live' flag is not provided and selected theme role is live", async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'live'})!
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      // When
      await runPushCommand([], path, adminSession)

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalled()
    })

    test('should render text prompt if unpublished flag is provided and theme flag is not provided', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(renderTextPrompt).mockResolvedValue('test_name')
      vi.mocked(DevelopmentThemeManager.prototype.create).mockResolvedValue(theme)

      // When
      await runPushCommand(['--unpublished'], path, adminSession)

      // Then
      expect(renderTextPrompt).toHaveBeenCalled()
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
