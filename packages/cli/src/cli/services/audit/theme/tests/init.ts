import {AssertionCollector} from '../../assertions.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getRandomName} from '@shopify/cli-kit/common/string'
import {exec} from '@shopify/cli-kit/node/system'
import type {AuditTest, AuditContext, TestResult} from '../../types.js'

// Expected files in a Skeleton theme
const EXPECTED_THEME_FILES = ['layout/theme.liquid', 'config/settings_schema.json', 'templates/index.json']

const EXPECTED_THEME_DIRECTORIES = ['sections', 'snippets', 'assets', 'locales']

export const initTest: AuditTest = {
  name: 'theme:init',
  description: 'Tests the theme init command creates a valid theme structure',

  async run(context: AuditContext): Promise<TestResult> {
    const startTime = Date.now()
    const assertions = new AssertionCollector()

    // Generate a unique theme name for this test run
    const themeName = `audit-theme-${getRandomName('creative')}`
    const themePath = joinPath(context.workingDirectory, themeName)

    try {
      // Run theme init command using exec (subprocess)
      // This tests the full CLI experience
      await exec('shopify', ['theme', 'init', themeName, '--path', context.workingDirectory], {
        cwd: context.workingDirectory,
        stdin: 'inherit',
      })

      // Assertion 1: Theme directory was created
      await assertions.assertDirectoryExists(themePath, `Theme directory "${themeName}" was created`)

      // Assertion 2: Essential theme files exist
      await assertions.assertFilesExist(themePath, EXPECTED_THEME_FILES, 'Essential theme files exist')

      // Assertion 3: Required directories exist
      for (const dir of EXPECTED_THEME_DIRECTORIES) {
        // eslint-disable-next-line no-await-in-loop
        await assertions.assertDirectoryExists(joinPath(themePath, dir), `Directory "${dir}" exists`)
      }

      // Assertion 4: layout/theme.liquid exists
      await assertions.assertFileExists(joinPath(themePath, 'layout/theme.liquid'), 'layout/theme.liquid file exists')

      // Update context for subsequent tests
      context.themeName = themeName
      context.themePath = themePath

      return {
        name: this.name,
        status: assertions.hasFailures() ? 'failed' : 'passed',
        duration: Date.now() - startTime,
        assertions: assertions.getResults(),
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return {
        name: this.name,
        status: 'failed',
        duration: Date.now() - startTime,
        assertions: assertions.getResults(),
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}
