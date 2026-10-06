import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {outputCompleted, outputResult} from '@shopify/cli-kit/node/output'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const authLoginJsonOutputSchema = defineJsonOutputSchema({
  name: 'AuthLoginResult',
  schema: zod.object({status: zod.literal('success'), alias: zod.string()}).strict(),
})

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
    const result = await promptSessionSelect(flags.alias)
    if (flags.json) {
      outputResult(authLoginJsonOutputSchema.encode({status: 'success', alias: result}))
    } else {
      outputCompleted(`Current account: ${result}.`)
    }
  }
}
