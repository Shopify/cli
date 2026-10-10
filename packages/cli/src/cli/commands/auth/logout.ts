import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult, outputSuccess} from '@shopify/cli-kit/node/output'
import {logout} from '@shopify/cli-kit/node/session'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const authLogoutJsonOutputSchema = defineJsonOutputSchema({
  name: 'AuthLogoutResult',
  schema: zod.object({status: zod.literal('success')}).strict(),
})

export default class Logout extends Command {
  static descriptionWithMarkdown = 'Logs you out of the Shopify account or Partner account and store.'

  static description = this.descriptionForHelp()

  static flags = {...globalFlags, ...jsonFlag}

  static get jsonOutputSchema() {
    return authLogoutJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logout)
    await logout()
    if (flags.json) {
      outputResult(authLogoutJsonOutputSchema.encode({status: 'success'}))
    } else {
      outputSuccess('Logged out from all the accounts')
    }
  }
}
