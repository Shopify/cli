import {Command} from '@oclif/core'
import {session, output} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    const token = await session.ensureAuthenticated({})
    output.success(`TOKEN: ${JSON.stringify(token)}`)
    // await session.ensureAuthenticated({})
  }
}
