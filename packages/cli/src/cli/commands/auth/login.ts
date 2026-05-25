import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {Flags} from '@oclif/core'
import {outputCompleted} from '@shopify/cli-kit/node/output'

export default class Login extends Command {
  static summary = 'Log in to a Shopify account.'

  static descriptionWithMarkdown = `Logs in to a Shopify account using a browser-based device authentication flow.

If Shopify CLI prints a verification URL and user code, open the URL in a browser, complete login, and keep the command running. The command continues automatically after authentication succeeds.

When running from an agent, show the verification URL and user code to the user, ask them to complete login in the browser, and wait for the command to finish.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --alias my-account']

  static flags = {
    alias: Flags.string({
      description: 'Alias of the session you want to login to.',
      env: 'SHOPIFY_FLAG_AUTH_ALIAS',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)
    const result = await promptSessionSelect(flags.alias)
    outputCompleted(`Current account: ${result}.`)
  }
}
