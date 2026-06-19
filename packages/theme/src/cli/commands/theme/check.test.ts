import Check from './check.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {
  themeCheckRun,
  ThemeCheckConfigError,
  Theme,
  Config as ThemeConfig,
  Offense,
} from '@shopify/theme-check-node'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/theme-check-node', async () => {
  const actual = await vi.importActual<typeof import('@shopify/theme-check-node')>('@shopify/theme-check-node')
  return {
    ...actual,
    themeCheckRun: vi.fn(),
    loadConfig: vi.fn(),
  }
})
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

    test('surfaces an invalid config as an AbortError instead of crashing', async () => {
      vi.mocked(themeCheckRun).mockRejectedValueOnce(
        new ThemeCheckConfigError("Failed to load Theme Check configuration from './.theme-check.yml'"),
      )

      await expect(run(['--config=./.theme-check.yml'])).rejects.toThrowError(AbortError)
    })

    test('rethrows errors from the check itself so genuine bugs are still reported', async () => {
      const bug = new Error('Something unexpected blew up inside a check')
      vi.mocked(themeCheckRun).mockRejectedValue(bug)

      await expect(run([])).rejects.toThrowError(bug)
      await expect(run([])).rejects.not.toThrowError(AbortError)
    })
  })
})
