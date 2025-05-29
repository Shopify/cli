import Command from '@shopify/cli-kit/node/base-command'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedUser} from '@shopify/cli-kit/node/session'

export default class Login extends Command {
  static description = 'Logs you in to your Shopify account.'

  async run(): Promise<void> {
    await ensureAuthenticatedUser({}, {forceNewSession: true})

    outputSuccess('Successfully logged in to Shopify')
  }
}
