import {themeFlags} from '../../flags.js'
import {
  formatOffensesJson,
  formatSummary,
  handleExit,
  initConfig,
  outputActiveChecks,
  outputActiveConfig,
  performAutoFixes,
  renderOffensesText,
  sortOffenses,
  isExtendedWriteStream,
  type FailLevel,
} from '../../services/check.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {themeCheckRun, LegacyIdentifiers} from '@shopify/theme-check-node'
import {findPathUp} from '@shopify/cli-kit/node/fs'
import {moduleDirectory, joinPath} from '@shopify/cli-kit/node/path'
import {getPackageVersion} from '@shopify/cli-kit/node/node-package-manager'

export default class Check extends ThemeCommand {
  static description = 'Validate the theme.'

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    'auto-correct': Flags.boolean({
      char: 'a',
      required: false,
      description: 'Automatically fix offenses',
      env: 'SHOPIFY_FLAG_AUTO_CORRECT',
    }),
    config: Flags.string({
      char: 'C',
      required: false,
      description: `Use the config provided, overriding .theme-check.yml if present
      Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
      theme-check:recommended, theme-check:all
      For backwards compatibility, :theme_app_extension is also supported `,
      env: 'SHOPIFY_FLAG_CONFIG',
    }),
    'fail-level': Flags.string({
      required: false,
      description: 'Minimum severity for exit with error code',
      env: 'SHOPIFY_FLAG_FAIL_LEVEL',
      options: ['crash', 'error', 'suggestion', 'style', 'warning', 'info'],
      default: 'error',
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

  async run(): Promise<void> {
    const {flags} = await this.parse(Check)

    // Its not clear to typescript that path will always be defined
    const path = flags.path
    // To support backwards compatibility for legacy configs
    const isLegacyConfig = flags.config?.startsWith(':') && LegacyIdentifiers.has(flags.config.slice(1))
    const config = isLegacyConfig ? LegacyIdentifiers.get(flags.config!.slice(1)) : flags.config

    if (flags.init) {
      await initConfig(path)

      // --init should not trigger full theme check operation
      return
    }

    if (flags.version) {
      const pkgJsonPath = await findPathUp(joinPath('node_modules', '@shopify', 'theme-check-node', 'package.json'), {
        type: 'file',
        cwd: moduleDirectory(import.meta.url),
      })

      let version = 'unknown'
      if (pkgJsonPath) {
        version = (await getPackageVersion(pkgJsonPath)) || 'unknown'
      }

      outputInfo(version)

      // --version should not trigger full theme check operation
      return
    }

    if (flags.print) {
      await outputActiveConfig(path, config)

      // --print should not trigger full theme check operation
      return
    }

    if (flags.list) {
      await outputActiveChecks(path, config)

      // --list should not trigger full theme check operation
      return
    }

    const {offenses, theme} = await themeCheckRun(path, config)

    const offensesByFile = sortOffenses(offenses)

    if (flags.output === 'text') {
      renderOffensesText(offensesByFile, path)

      // Use renderSuccess when theres no offenses
      const render = offenses.length ? renderInfo : renderSuccess

      render({
        headline: 'Theme Check Summary.',
        body: formatSummary(offenses, offensesByFile, theme),
      })
    }

    if (flags.output === 'json') {
      /**
       * Workaround:
       * Force stdout to be blocking so that the JSON output is not broken when piped to another process.
       * ie: ` | jq .`
       * It turns out that console.log is technically asynchronous, and when we call process.exit(),
       * node doesn't wait on all the output being sent to stdout and instead closes the process immediately
       *
       * https://github.com/pnp/cli-microsoft365/issues/1266#issuecomment-727254264
       *
       */
      const stdout = process.stdout
      if (isExtendedWriteStream(stdout)) {
        stdout._handle.setBlocking(true)
      }

      outputInfo(JSON.stringify(formatOffensesJson(offensesByFile)))
    }

    if (flags['auto-correct']) {
      await performAutoFixes(theme, offenses)
    }

    return handleExit(offenses, flags['fail-level'] as FailLevel)
  }
}
