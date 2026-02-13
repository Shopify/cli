import {runThemeDoctor} from '../../../services/doctor-release/theme/runner.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {canRunDoctorRelease} from '@shopify/cli-kit/node/context/local'
import {renderConfirmationPrompt, RenderConfirmationPromptOptions} from '@shopify/cli-kit/node/ui'

export default class DoctorReleaseTheme extends Command {
  static description = 'Run all theme command doctor-release tests'
  static hidden = true

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
    if (!canRunDoctorRelease()) {
      return
    }
    const promptOptions: RenderConfirmationPromptOptions = {
      message: `This will run automated theme commands against your shop. It will modify remote themes. Please confirm before running.`,
      confirmationMessage: 'Yes I understand',
      cancellationMessage: 'No, cancel the command',
    }
    const confirmed = await renderConfirmationPrompt(promptOptions)

    if (!confirmed) {
      return
    }
    const {flags} = await this.parse(DoctorReleaseTheme)

    const results = await runThemeDoctor({
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
