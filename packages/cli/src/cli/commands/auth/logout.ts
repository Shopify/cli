import Command from '@shopify/cli-kit/node/base-command'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {logout} from '@shopify/cli-kit/node/session'

export default class Logout extends Command {
  static description = 'Logout from Shopify.'

  async run(): Promise<void> {
    await logout()
    outputSuccess('Logged out from Shopify')
  }
}
