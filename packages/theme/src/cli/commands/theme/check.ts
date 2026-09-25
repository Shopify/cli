import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {
  checkTheme,
  initConfig,
  outputActiveChecks,
  outputActiveConfig,
  performAutoFixes,
  handleExit,
  type FailLevel,
} from '../../services/check.js'
import {renderThemeCheckResult, encodeThemeCheckResult} from '../../services/check/result.js'
import {themeCheckJsonOutputSchema} from '../../services/check/types.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {LegacyIdentifiers} from '@shopify/theme-check-node'
import {findPathUp} from '@shopify/cli-kit/node/fs'
import {moduleDirectory, joinPath} from '@shopify/cli-kit/node/path'
import {getPackageVersion} from '@shopify/cli-kit/node/node-package-manager'
import {InferredFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'

type CheckFlags = InferredFlags<typeof Check.flags>
export default class Check extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeCheckJsonOutputSchema
  }

  static summary = 'Validate the theme.'

  static descriptionWithMarkdown = `Calls and runs [Theme Check](https://shopify.dev/docs/themes/tools/theme-check) to analyze your theme code for errors and to ensure that it follows theme and Liquid best practices. [Learn more about the checks that Theme Check runs.](https://shopify.dev/docs/themes/tools/theme-check/checks)`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    json: Flags.boolean({...jsonFlag.json, env: 'SHOPIFY_FLAG_JSON', exclusive: ['init', 'version', 'print', 'list']}),
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

  static multiEnvironmentsFlags: RequiredFlags = ['path']

  async command(flags: CheckFlags, _session: AdminSession, multiEnvironment: boolean) {
    // Its not clear to typescript that path will always be defined
    const path = flags.path
    const environment = flags.environment?.[0]
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
        version = (await getPackageVersion(pkgJsonPath)) ?? 'unknown'
      }

      outputResult(version)

      // --version should not trigger full theme check operation
      return
    }

    if (flags.print) {
      await outputActiveConfig(path, config, environment)

      // --print should not trigger full theme check operation
      return
    }

    if (flags.list) {
      await outputActiveChecks(path, config, environment)

      // --list should not trigger full theme check operation
      return
    }

    const output = await checkTheme(path, config, environment)
    const {offenses, theme} = output
    const json = flags.json || flags.output === 'json'
    if (!multiEnvironment || !json) {
      renderThemeCheckResult(output, json ? 'json' : flags.output, path, environment)
    }

    if (flags['auto-correct']) {
      await performAutoFixes(theme, offenses)
    }

    if (!multiEnvironment) {
      return handleExit(offenses, flags['fail-level'] as FailLevel)
    }
    if (json) return output.result
  }

  protected collectsEnvironmentResults(flags: Partial<CheckFlags>): boolean {
    return (
      !flags.init && !flags.version && !flags.print && !flags.list && (Boolean(flags.json) || flags.output === 'json')
    )
  }

  protected renderEnvironmentResults(environments: {environment: string; result: unknown}[]): void {
    outputResult(encodeThemeCheckResult(themeCheckJsonOutputSchema.validate({environments})))
  }
}

// Compatibility adapter for theme push, which still presents check results as text.
export async function runThemeCheck(path: string, outputFormat: string, config?: string, environment?: string) {
  const result = await checkTheme(path, config, environment)
  renderThemeCheckResult(result, outputFormat, path, environment)
  return {offenses: result.offenses, theme: result.theme}
}
