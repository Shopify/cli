import {authLoginJsonOutputSchema} from '../../services/commands/auth/login/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelectWithDetails} from '@shopify/cli-kit/node/session-prompt'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {outputCompleted, outputResult} from '@shopify/cli-kit/node/output'

export default class Login extends Command {
  static descriptionWithMarkdown = 'Logs you in to your Shopify account.'

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    alias: requiredIfNonInteractive(
      Flags.string({
        description: 'Alias of an existing session you want to use.',
        env: 'SHOPIFY_FLAG_AUTH_ALIAS',
      }),
    ),
  }

  static get jsonOutputSchema() {
    return authLoginJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)
    const result = await promptSessionSelectWithDetails(flags.alias)
    if (flags.json) {
      outputResult(
        authLoginJsonOutputSchema.encode({
          status: 'success',
          userId: result.userId,
          alias: result.alias,
          email: result.email,
        }),
      )
    } else {
      outputCompleted(`Current account: ${result.alias}.`)
    }
  }
}
