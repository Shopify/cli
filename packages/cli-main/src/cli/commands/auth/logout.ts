import Command from '@shopify/cli-kit/node/base-command'
import {output, session} from '@shopify/cli-kit'

export default class Logout extends Command {
  static description = 'Logout from Shopify'

  async run(): Promise<void> {
    await session.logout()
    output.success('Logged out from Shopify')
  }
}
