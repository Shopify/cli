import Command from '@shopify/cli-kit/node/base-command'
import {getCurrentUserInfo} from '@shopify/cli-kit/node/session'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Whoami extends Command {
  static description = 'Displays the currently logged-in Shopify account.'

  async run(): Promise<void> {
    const userInfo = await getCurrentUserInfo()
    if (userInfo) {
      outputInfo(`Logged in as: ${userInfo.alias}`)
    } else {
      throw new AbortError('Not logged in.', 'Run `shopify auth login` to log in.')
    }
  }
}
