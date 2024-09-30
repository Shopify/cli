import Pull from './pull.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {describe, vi, expect, test} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('../../services/pull.js')
vi.mock('../../utilities/development-theme-manager.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

describe('Pull', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  describe('run with CLI 2 implementation', () => {
    async function run(argv: string[], theme?: Theme) {
      await runPullCommand(['--legacy', ...argv], path, adminSession, theme)
    }

    function expectCLI2ToHaveBeenCalledWith(command: string) {
      expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
        adminToken: adminSession.token,
        store: 'example.myshopify.com',
      })
    }

    test('should pass development theme from local storage to CLI 2', async () => {
      vi.mocked(useEmbeddedThemeCLI).mockReturnValue(true)

      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      await run([], theme)

      expect(DevelopmentThemeManager.prototype.find).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme pull ${path} --development-theme-id ${theme.id}`)
    })

    test('should pass theme and development theme from local storage to CLI 2', async () => {
      vi.mocked(useEmbeddedThemeCLI).mockReturnValue(true)

      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      await run([`--theme=${themeId}`], theme)

      expectCLI2ToHaveBeenCalledWith(`theme pull ${path} --theme ${themeId} --development-theme-id ${theme.id}`)
    })

    test("should not pass development theme to CLI 2 when user isn't using the embedded CLI", async () => {
      vi.mocked(useEmbeddedThemeCLI).mockReturnValue(false)

      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      await run([`--theme=${themeId}`], theme)

      expectCLI2ToHaveBeenCalledWith(`theme pull ${path} --theme ${themeId}`)
    })

    test('should not pass development theme to CLI 2 if local storage is empty', async () => {
      vi.mocked(useEmbeddedThemeCLI).mockReturnValue(true)
      await run([])

      expect(DevelopmentThemeManager.prototype.find).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme pull ${path}`)
    })

    test('should pass theme and development theme to CLI 2', async () => {
      vi.mocked(useEmbeddedThemeCLI).mockReturnValue(true)
      const theme = buildTheme({id: 4, name: 'Theme', role: 'development'})!
      await run(['--development'], theme)

      expect(DevelopmentThemeManager.prototype.find).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(`theme pull ${path} --theme ${theme.id} --development-theme-id ${theme.id}`)
    })
  })

  async function runPullCommand(argv: string[], path: string, adminSession: AdminSession, theme?: Theme) {
    vi.mocked(renderWarning).mockReturnValue('shhh!')
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    if (theme) {
      vi.spyOn(DevelopmentThemeManager.prototype, 'find').mockResolvedValue(theme)
    }
    vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)

    await CommandConfig.load()
    const pull = new Pull([`--path=${path}`, ...argv], CommandConfig)

    await pull.run()
  }
})
