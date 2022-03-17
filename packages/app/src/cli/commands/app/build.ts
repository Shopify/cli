import {Command} from '@oclif/core'
import {session} from '@shopify/cli-kit'

import {OAuthSession} from '../../../../../cli-kit/src/session'

export default class Build extends Command {
  static description = 'Build a block or an app'

  async run(): Promise<void> {
    const token: OAuthSession = await session.ensureAuthenticated({})
    console.log('TOKEN:', token)
    // await session.ensureAuthenticated({})
  }
}
