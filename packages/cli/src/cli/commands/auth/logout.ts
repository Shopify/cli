import Command from '@shopify/cli-kit/node/base-command'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {logout} from '@shopify/cli-kit/node/session'

export default class Logout extends Command {
  static description = 'Logs you out of the Shopify account or Partner account and store.'

  async run(): Promise<void> {
    await logout()
    outputSuccess('Logged out from Shopify')
  }
}
