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

  tests() {
    this.test('init creates theme directory', async () => {
      this.themeName = `audit-theme-${getRandomName('creative')}`
      this.themePath = joinPath(this.context.workingDirectory, this.themeName)

      const result = await this.runInteractive(
        `shopify theme init ${this.themeName} --path ${this.context.workingDirectory}`,
      )
      this.assertSuccess(result)

      // Store for tests later in the suite
      this.context.themeName = this.themeName
      this.context.themePath = this.themePath
    })

    this.test('essential theme files exist', async () => {
      const essentialFiles = ['layout/theme.liquid', 'config/settings_schema.json', 'templates/index.json']

      for (const file of essentialFiles) {
        // eslint-disable-next-line no-await-in-loop
        await this.assertFile(joinPath(this.themePath, file))
      }
    })

    this.test('theme directories exist', async () => {
      const directories = ['sections', 'snippets', 'assets', 'locales']

      for (const dir of directories) {
        // eslint-disable-next-line no-await-in-loop
        await this.assertDirectory(joinPath(this.themePath, dir))
      }
    })

    this.test('layout/theme.liquid has valid content', async () => {
      await this.assertFile(
        joinPath(this.themePath, 'layout/theme.liquid'),
        /<!doctype html>|<html|{{ content_for_header }}/i,
        'layout/theme.liquid contains expected Liquid markup',
      )
    })
  }
}
