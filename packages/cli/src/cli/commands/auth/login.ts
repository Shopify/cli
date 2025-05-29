import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'

export default class Login extends Command {
  static description = 'Logs you in to your Shopify account.'

  async run(): Promise<void> {
    await promptSessionSelect()
  }
}
