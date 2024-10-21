import Push from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {getDevelopmentTheme, removeDevelopmentTheme, setDevelopmentTheme} from '../../services/local-storage.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('../../services/push.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../services/local-storage.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

describe('Push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  beforeEach(() => {
    vi.mocked(getDevelopmentTheme).mockImplementation(() => undefined)
    vi.mocked(setDevelopmentTheme).mockImplementation(() => undefined)
    vi.mocked(removeDevelopmentTheme).mockImplementation(() => undefined)
  })

  describe('run with Ruby implementation', () => {
    test('should pass development theme from local storage to Ruby implementation', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run([])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --development-theme-id ${theme.id}`)
    })

    test('should pass theme and development theme from local storage to Ruby implementation', async () => {
      // Given
      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run([`--theme=${themeId}`])

      // Then
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --theme ${themeId} --development-theme-id ${theme.id}`)
    })

    test('should not pass development theme to Ruby implementation if local storage is empty', async () => {
      // When
      await run([])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path}`)
    })

    test('should pass theme and development theme to Ruby implementation', async () => {
      // Given
      const theme = buildTheme({id: 4, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run(['--development'])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --theme ${theme.id} --development-theme-id ${theme.id}`)
    })
  })

  async function run(argv: string[]) {
    await runPushCommand(['--legacy-3.66', ...argv], path, adminSession)
  }

  function expectCLI2ToHaveBeenCalledWith(command: string) {
    expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
      store: 'example.myshopify.com',
      adminToken: adminSession.token,
    })
  }

  async function runPushCommand(argv: string[], path: string, adminSession: AdminSession) {
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)

    await CommandConfig.load()
    const push = new Push([`--path=${path}`, ...argv], CommandConfig)

    await push.run()
  }
})
