import {Command} from '@oclif/core'
import {session} from '@shopify/cli-kit'
import {success} from '@shopify/cli-kit/src/output'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    const token = await session.ensureAuthenticated({})
    success(`TOKEN: ${token}`)
    // await session.ensureAuthenticated({})
  }
}
