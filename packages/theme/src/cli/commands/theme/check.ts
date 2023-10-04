import {themeDevPreviewFlag, themeFlags} from '../../flags.js'
import {
  formatOffensesJson,
  formatSummary,
  handleExit,
  initConfig,
  outputActiveConfig,
  performAutoFixes,
  renderOffensesText,
  runThemeCheck,
  sortOffenses,
  type FailLevel,
} from '../../services/check.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import themeCheckPackage from '@shopify/theme-check-node/package.json' assert {type: 'json'}

export default class Check extends ThemeCommand {
  static description = 'Validate the theme.'

  static flags = {
    ...globalFlags,
    ...themeDevPreviewFlag,
    path: themeFlags.path,
    'auto-correct': Flags.boolean({
      char: 'a',
      required: false,
      description: 'Automatically fix offenses',
      env: 'SHOPIFY_FLAG_AUTO_CORRECT',
    }),
    // Typescript theme check no longer uses `--category`
    // Remove this when we remove the ruby version
    category: Flags.string({
      char: 'c',
      required: false,
      description: `Only run this category of checks
Runs checks matching all categories when specified more than once`,
      env: 'SHOPIFY_FLAG_CATEGORY',
    }),
    config: Flags.string({
      char: 'C',
      required: false,
      description: `Use the config provided, overriding .theme-check.yml if present
Use :theme_app_extension to use default checks for theme app extensions`,
      env: 'SHOPIFY_FLAG_CONFIG',
    }),
    // Typescript theme check no longer uses `--exclude-categories`
    // Remove this when we remove the ruby version
    'exclude-category': Flags.string({
      char: 'x',
      required: false,
      description: `Exclude this category of checks
Excludes checks matching any category when specified more than once`,
      env: 'SHOPIFY_FLAG_EXCLUDE_CATEGORY',
    }),
    'fail-level': Flags.string({
      required: false,
      description: 'Minimum severity for exit with error code',
      env: 'SHOPIFY_FLAG_FAIL_LEVEL',
      options: ['error', 'suggestion', 'style'],
    }),

    /**
     * Typescript theme check no longer uses `--update-docs`
     * theme check initialization verifies it has the latest revision of theme docs
     * every time it runs, and downloads the latest revision if it doesn't.
     */
    'update-docs': Flags.boolean({
      required: false,
      description: 'Update Theme Check docs (objects, filters, and tags)',
      env: 'SHOPIFY_FLAG_UPDATE_DOCS',
    }),
    init: Flags.boolean({
      required: false,
      description: 'Generate a .theme-check.yml file',
      env: 'SHOPIFY_FLAG_INIT',
    }),
    list: Flags.boolean({
      required: false,
      description: 'List enabled checks',
      env: 'SHOPIFY_FLAG_LIST',
    }),
    output: Flags.string({
      char: 'o',
      required: false,
      description: 'The output format to use',
      env: 'SHOPIFY_FLAG_OUTPUT',
      options: ['text', 'json'],
      default: 'text',
    }),
    print: Flags.boolean({
      required: false,
      description: 'Output active config to STDOUT',
      env: 'SHOPIFY_FLAG_PRINT',
    }),
    version: Flags.boolean({
      char: 'v',
      required: false,
      description: 'Print Theme Check version',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    environment: themeFlags.environment,
  }

  static cli2Flags = [
    'auto-correct',
    'category',
    'config',
    'exclude-category',
    'update-docs',
    'fail-level',
    'init',
    'list',
    'output',
    'print',
    'version',
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Check)

    if (flags['dev-preview']) {
      if (flags.init) {
        await initConfig(flags.path)

        // --init should not trigger full theme check operation
        return
      }

      if (flags.version) {
        outputInfo(themeCheckPackage.version)

        // --version should not trigger full theme check operation
        return
      }

      if (flags.print) {
        await outputActiveConfig(flags.config, flags.path)
        return
      }

      if (flags.list) {
        // todo: implement --list

        // --list should not trigger full theme check operation
        return
      }

      const {offenses, theme, config} = await runThemeCheck(flags.path, flags.config)
      const offensesByFile = sortOffenses(offenses)

      if (flags.output === 'text') {
        renderOffensesText(offensesByFile, flags.path)

        renderInfo({
          headline: 'Theme Check Summary.',
          body: formatSummary(offenses, theme),
        })
      }

      if (flags.output === 'json') {
        outputInfo(JSON.stringify(formatOffensesJson(offensesByFile), null, 2))
      }

      if (flags['auto-correct']) {
        await performAutoFixes(theme, offenses)
      }

      handleExit(offenses, flags['fail-level'] as FailLevel)
    }

    await execCLI2(['theme', 'check', flags.path, ...this.passThroughFlags(flags, {allowedFlags: Check.cli2Flags})], {
      directory: flags.path,
    })
  }
}
