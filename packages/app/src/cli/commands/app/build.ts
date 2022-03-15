import {Command} from '@oclif/core'
import {session} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    const token = await session.ensureAuthenticatedPartners()
    console.log('TOKEN:', token)
    // await session.ensureAuthenticated({})
  }
}
