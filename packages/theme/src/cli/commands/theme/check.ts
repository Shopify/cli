import {themeDevPreviewFlag, themeFlags} from '../../flags.js'
import {formatOffensesJson, formatSummary, renderOffensesText, sortOffenses} from '../../services/check.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderInfo, renderTasks, type Task} from '@shopify/cli-kit/node/ui'
import {ThemeCheckRun, themeCheckRun} from '@shopify/theme-check-node'

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
    // todo: this requires implementation for typescript theme check
    'fail-level': Flags.string({
      required: false,
      description: 'Minimum severity for exit with error code',
      env: 'SHOPIFY_FLAG_FAIL_LEVEL',
      options: ['error', 'suggestion', 'style'],
    }),
    // theme-docs-updater thingy
    'update-docs': Flags.boolean({
      required: false,
      description: 'Update Theme Check docs (objects, filters, and tags)',
      env: 'SHOPIFY_FLAG_UPDATE_DOCS',
    }),

    // new and only lives here, copy recommended or extends: recommended
    // todo: this requires implementation for typescript theme check
    init: Flags.boolean({
      required: false,
      description: 'Generate a .theme-check.yml file',
      env: 'SHOPIFY_FLAG_INIT',
    }),

    // read the config and list all the enabled ones... unforutnate but logic for loadConfig is in theme-language-server-node right now..... I think?
    // config is { settings: { checkName: {...} }, checks: CheckDefinition[], root, ignore: string[] }
    // todo: this requires implementation for typescript theme check
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
    // similar to list but just prints the config as YAML(?)
    // todo: this requires implementation for typescript theme check
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
      let themeCheckResults = {} as ThemeCheckRun

      const themeCheckTask: Task = {
        title: `Performing theme check. Please wait...\nEvaluating ${flags.path}`,
        task: async () => {
          themeCheckResults = await themeCheckRun(flags.path, flags.config)
        },
      }

      await renderTasks([themeCheckTask])

      const {offenses, theme} = themeCheckResults

      // Bucket offenses by absolute path
      const offensesByFile = sortOffenses(offenses)

      if (flags.output === 'text') {
        renderOffensesText(offensesByFile, flags.path)

        renderInfo({
          headline: 'Theme Check Summary.',
          body: formatSummary(offenses, theme),
        })
        return
      }

      if (flags.output === 'json') {
        // JSON output should go to STDOUT without additional formatting
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(formatOffensesJson(offensesByFile), null, 2))
        return
      }
    }

    await execCLI2(['theme', 'check', flags.path, ...this.passThroughFlags(flags, {allowedFlags: Check.cli2Flags})], {
      directory: flags.path,
    })
  }
}
