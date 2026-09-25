import {authTokenJsonOutputSchema, getAuthToken} from '../../services/commands/auth/token.js'
import Command from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {Flags} from '@oclif/core'

export default class Token extends Command {
  static hidden = true
  static summary = 'Prototype: print an API access token for the signed-in Shopify account.'
  static descriptionWithMarkdown =
    'Prints only the access token to stdout by default. Reuses the selected CLI account and refreshes credentials when needed. ' +
    'Run `shopify auth login` interactively first when using this command in a script. ' +
    'The token retains its App Management permissions; it is not read-only or restricted to one app. ' +
    "Treat it as a secret and don't include it in logs or agent conversations. Automation tokens are not supported."

  static get jsonOutputSchema() {
    return authTokenJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...authAliasFlag,
    ...jsonFlag,
    api: Flags.string({
      description: 'API to obtain an access token for.',
      env: 'SHOPIFY_FLAG_API',
      options: ['app-management'],
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Token)
    const result = await getAuthToken({
      noPrompt: !terminalSupportsPrompting(),
    })
    outputResult(flags.json ? authTokenJsonOutputSchema.encode(result) : result.accessToken)
  }
}
