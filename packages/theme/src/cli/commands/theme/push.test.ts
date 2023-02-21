import Push from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {describe, it, vi, expect} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'

vi.mock('../../utilities/development-theme-manager.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/path')

describe('Push', () => {
  describe('run', () => {
    const adminSession = {token: '', storeFqdn: ''}

    async function run(argv: string[], theme?: Theme) {
      vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
      vi.mocked(isAbsolutePath).mockReturnValue(true)
      if (theme) {
        vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      }
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)

      const config = {} as Config
      const push = new Push(argv, config)

      await push.run()
    }

    function expectCLI2ToHaveBeenCalledWith(command: string) {
      expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
        adminSession,
      })
    }

    it('should pass development theme from local storage to CLI 2', async () => {
      const theme = new Theme(1, 'Theme', 'development')
      await run([], theme)

      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push . --development-theme-id ${theme.id}`)
    })

    it('should pass theme and development theme from local storage to CLI 2', async () => {
      const themeId = 2
      const theme = new Theme(3, 'Theme', 'development')
      await run([`--theme=${themeId}`], theme)

      expectCLI2ToHaveBeenCalledWith(`theme push . --theme ${themeId} --development-theme-id ${theme.id}`)
    })

    it('should not pass development theme to CLI 2 if local storage is empty', async () => {
      await run([])

      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith('theme push .')
    })

    it('should pass theme and development theme to CLI 2', async () => {
      const theme = new Theme(4, 'Theme', 'development')
      await run(['--development'], theme)

      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(`theme push . --theme ${theme.id} --development-theme-id ${theme.id}`)
    })
  })
})
