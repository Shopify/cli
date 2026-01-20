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
      description: 'The environment to use from shopify.theme.toml for store-connected tests.',
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
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
    only: Flags.string({
      char: 'o',
      description: 'Run only specific tests (can be specified multiple times)',
      multiple: true,
    }),
    skip: Flags.string({
      description: 'Skip specific tests (can be specified multiple times)',
      multiple: true,
    }),
    'fail-fast': Flags.boolean({
      description: 'Stop on first test failure',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuditTheme)

    const results = await runThemeAudit({
      path: flags.path,
      environment: flags.environment,
      store: flags.store,
      password: flags.password,
      only: flags.only,
      skip: flags.skip,
      failFast: flags['fail-fast'],
    })

    // Exit with error code if any tests failed
    const failed = results.some((result) => result.status === 'failed')
    if (failed) {
      process.exitCode = 1
    }
  }
}
