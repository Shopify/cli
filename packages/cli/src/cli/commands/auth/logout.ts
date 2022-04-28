import {Command, Flags} from '@oclif/core'
import {output, path, session, ui} from '@shopify/cli-kit'

export default class Logout extends Command {
  static description = 'Logout from Shopify'

  async run(): Promise<void> {
    await session.logout()
    output.success('Logged out from Shopify')
  }
}
