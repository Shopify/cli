import Command from '@shopify/cli-kit/node/base-command'
import {output, session, store} from '@shopify/cli-kit'

export default class Logout extends Command {
  static description = 'Logout from Shopify'

  async run(): Promise<void> {
    await session.logout()
    store.cliKitStore().removeSession()
    output.success('Logged out from Shopify')
  }
}
