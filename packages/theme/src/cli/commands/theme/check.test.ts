import Check, {runThemeCheck} from './check.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {themeCheckRun, Theme, Config as ThemeConfig, Offense} from '@shopify/theme-check-node'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/theme-check-node')
const CommandConfig = new Config({root: __dirname})

describe('Check', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never
    })
  })

  describe('run', () => {
    const path = '/my-theme'

    async function run(argv: string[]) {
      await CommandConfig.load()
      const check = new Check([`--path=${path}`, ...argv], CommandConfig)

      await check.run()
    }

    test('should change config to "theme-check:recommended" when ":default" is inputted', async () => {
      const mockTheme: Theme = []
      const mockConfig: ThemeConfig = {
        context: 'theme',
        settings: {},
        checks: [],
        rootUri: '',
      }
      const mockOffenses: Offense[] = []

      vi.mocked(themeCheckRun).mockImplementation(async (path, config) => {
        expect(config).toBe('theme-check:recommended')
        return {offenses: mockOffenses, theme: mockTheme, config: mockConfig}
      })

      await run(['--config=:default'])
    })

    test('should change config to "theme-check:theme-app-extension" when ":theme_app_extensions" is inputted', async () => {
      const mockTheme: Theme = []
      const mockConfig: ThemeConfig = {
        context: 'app',
        settings: {},
        checks: [],
        rootUri: '',
      }
      const mockOffenses: Offense[] = []

      vi.mocked(themeCheckRun).mockImplementation(async (path, config) => {
        expect(config).toBe('theme-check:theme-app-extension')
        return {offenses: mockOffenses, theme: mockTheme, config: mockConfig}
      })

      await run(['--config=:theme_app_extensions'])
    })

    test('should not change config when ":theme_app_extension" is not inputted', async () => {
      const expectedConfig = 'some-config'
      const mockTheme: Theme = []
      const mockConfig: ThemeConfig = {
        context: 'theme',
        settings: {},
        checks: [],
        rootUri: '',
      }
      const mockOffenses: Offense[] = []

      vi.mocked(themeCheckRun).mockImplementation(async (path, config) => {
        expect(config).toBe(expectedConfig)
        return {offenses: mockOffenses, theme: mockTheme, config: mockConfig}
      })

      await run([`--config=${expectedConfig}`])
    })

    test('reports a missing explicitly configured file as an expected error', async () => {
      const config = './.theme-check.yml'
      const missingConfigError = Object.assign(new Error(`ENOENT: no such file or directory, open '${config}'`), {
        code: 'ENOENT',
        path: config,
      })
      vi.mocked(themeCheckRun).mockRejectedValue(missingConfigError)

      const result = runThemeCheck(path, 'text', config)

      await expect(result).rejects.toBeInstanceOf(AbortError)
      await expect(result).rejects.toThrowError(`Theme Check config file not found: ${config}`)
    })

    test('does not treat a missing extended config as a missing explicitly configured file', async () => {
      const config = '/my-theme/.theme-check.yml'
      const missingExtendedConfigError = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
        path: '/my-theme/missing-extended.yml',
      })
      vi.mocked(themeCheckRun).mockRejectedValue(missingExtendedConfigError)

      await expect(runThemeCheck(path, 'text', config)).rejects.toBe(missingExtendedConfigError)
    })

    test('does not treat other config failures as a missing explicitly configured file', async () => {
      const config = '/my-theme/.theme-check.yml'
      const permissionError = Object.assign(new Error('EACCES'), {code: 'EACCES', path: config})
      vi.mocked(themeCheckRun).mockRejectedValue(permissionError)

      await expect(runThemeCheck(path, 'text', config)).rejects.toBe(permissionError)
    })

    test('does not treat missing files as config errors when no config was explicitly provided', async () => {
      const missingThemeFileError = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
        path: '/my-theme/templates/index.liquid',
      })
      vi.mocked(themeCheckRun).mockRejectedValue(missingThemeFileError)

      await expect(runThemeCheck(path, 'text')).rejects.toBe(missingThemeFileError)
    })
  })
})
