import Check from './check.js'
import {describe, vi, expect, test, beforeEach, afterAll, SpyInstance} from 'vitest'
import {Config} from '@oclif/core'
import {themeCheckRun, Theme, Config as ThemeConfig, Offense} from '@shopify/theme-check-node'

vi.mock('@shopify/theme-check-node')

describe('Check', () => {
  let exitSpy: SpyInstance

  beforeEach(() => {
    // Create a spy on process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(vi.fn())
  })

  afterAll(() => {
    // Restore the original process.exit function after each test
    exitSpy.mockRestore()
  })

  describe('run', () => {
    const path = '/my-theme'

    async function run(argv: string[]) {
      const config = {} as Config
      const check = new Check([`--path=${path}`, ...argv], config)

      await check.run()
    }

    test('should change config to "theme-check:recommended" when ":default" is inputted', async () => {
      const mockTheme: Theme = []
      const mockConfig: ThemeConfig = {
        context: 'theme',
        settings: {},
        checks: [],
        root: '',
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
        root: '',
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
        root: '',
      }
      const mockOffenses: Offense[] = []

      vi.mocked(themeCheckRun).mockImplementation(async (path, config) => {
        expect(config).toBe(expectedConfig)
        return {offenses: mockOffenses, theme: mockTheme, config: mockConfig}
      })

      await run([`--config=${expectedConfig}`])
    })
  })
})
