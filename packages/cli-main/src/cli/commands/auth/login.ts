import Command from '@shopify/cli-kit/node/base-command'
import {session} from '@shopify/cli-kit'

export default class Login extends Command {
  static description = 'Logout from Shopify'

  async run(): Promise<void> {
    console.log('STARTING!')
    const tokens = await session.ensureAuthenticatedPartners()
    console.log(tokens)
    console.log('Done!')
  }
}
