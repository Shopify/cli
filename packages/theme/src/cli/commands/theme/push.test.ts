import Push from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {describe, vi, expect, test} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('../../utilities/development-theme-manager.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')

describe('Push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  describe('run with CLI 3 implementation', () => {
    test('should pass call the CLI 3 command', async () => {
      await runPushCommand([], path, adminSession)

      expect(execCLI2).not.toHaveBeenCalled()
    })
  })

  describe('run with CLI 2 implementation', () => {
    async function run(argv: string[], theme?: Theme) {
      await runPushCommand(['--stable', ...argv], path, adminSession, theme)
    }

    function expectCLI2ToHaveBeenCalledWith(command: string) {
      expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
        store: 'example.myshopify.com',
        adminToken: adminSession.token,
      })
    }

    test('should pass development theme from local storage to CLI 2', async () => {
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      await run([], theme)

      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --development-theme-id ${theme.id}`)
    })

    test('should pass theme and development theme from local storage to CLI 2', async () => {
      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      await run([`--theme=${themeId}`], theme)

      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --theme ${themeId} --development-theme-id ${theme.id}`)
    })

    test('should not pass development theme to CLI 2 if local storage is empty', async () => {
      await run([])

      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path}`)
    })

    test('should pass theme and development theme to CLI 2', async () => {
      const theme = buildTheme({id: 4, name: 'Theme', role: 'development'})!
      await run(['--development'], theme)

      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --theme ${theme.id} --development-theme-id ${theme.id}`)
    })
  })

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
