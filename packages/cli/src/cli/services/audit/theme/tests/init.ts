import {AuditSuite} from '../../framework.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getRandomName} from '@shopify/cli-kit/common/string'

/**
 * Tests for `shopify theme init` command
 */
export default class ThemeInitTests extends AuditSuite {
  static description = 'Tests the theme init command creates a valid theme structure'

  private themeName = ''
  private themePath = ''

  async 'test init creates theme directory'() {
    this.themeName = `audit-theme-${getRandomName('creative')}`
    this.themePath = joinPath(this.context.workingDirectory, this.themeName)

    const result = await this.runInteractive(`shopify theme init ${this.themeName} --path ${this.context.workingDirectory}`)
    this.assertSuccess(result)

    // Store for other tests
    this.context.themeName = this.themeName
    this.context.themePath = this.themePath
  }

  async 'test essential theme files exist'() {
    const essentialFiles = [
      'layout/theme.liquid',
      'config/settings_schema.json',
      'templates/index.json',
    ]

    for (const file of essentialFiles) {
      // eslint-disable-next-line no-await-in-loop
      await this.assertFile(joinPath(this.themePath, file))
    }
  }

  async 'test theme directories exist'() {
    const directories = ['sections', 'snippets', 'assets', 'locales']

    for (const dir of directories) {
      // eslint-disable-next-line no-await-in-loop
      await this.assertDirectory(joinPath(this.themePath, dir))
    }
  }

  async 'test layout/theme.liquid has valid content'() {
    await this.assertFile(
      joinPath(this.themePath, 'layout/theme.liquid'),
      /<!doctype html>|<html|{{ content_for_header }}/i,
      'layout/theme.liquid contains expected Liquid markup',
    )
  }
}

// Also export the old interface for backwards compatibility during transition
export const initTest = {
  name: 'theme:init',
  description: ThemeInitTests.description,
  async run(context: import('../../types.js').AuditContext) {
    const suite = new ThemeInitTests()
    const results = await suite.runSuite(context)
    // Combine all test results into one
    const allAssertions = results.flatMap((r) => r.assertions)
    const hasFailures = results.some((r) => r.status === 'failed')
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    return {
      name: 'theme:init',
      status: hasFailures ? 'failed' : ('passed' as const),
      duration: totalDuration,
      assertions: allAssertions,
      error: results.find((r) => r.error)?.error,
    }
  },
}
