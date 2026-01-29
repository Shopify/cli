import {runThemeAudit} from '../../../services/audit/theme/runner.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class AuditTheme extends Command {
  static description = 'Run all theme command audit tests'
  static hidden = true
  static hiddenAliases = ['audit theme']

  static flags = {
    ...globalFlags,
    path: Flags.string({
      char: 'p',
      description: 'The path to run tests in. Defaults to current directory.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
    environment: Flags.string({
      char: 'e',
      description: 'The environment to use from shopify.theme.toml (required for store-connected tests).',
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
      required: true,
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL (overrides environment).',
      env: 'SHOPIFY_FLAG_STORE',
    }),
    password: Flags.string({
      description: 'Password from Theme Access app (overrides environment).',
      env: 'SHOPIFY_FLAG_PASSWORD',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuditTheme)

    const results = await runThemeAudit({
      path: flags.path,
      environment: flags.environment,
      store: flags.store,
      password: flags.password,
    })

    // Exit with error code if any tests failed
    const failed = results.some((result) => result.status === 'failed')
    if (failed) {
      process.exitCode = 1
    }
  }
}
