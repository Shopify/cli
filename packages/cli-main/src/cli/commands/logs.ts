import Command from '@shopify/cli-kit/node/base-command'
import {cli, log} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'

export default class Logs extends Command {
  static description = 'View full debug logs from the Shopify CLI'

  static flags = {
    ...cli.globalFlags,
    'last-command': Flags.boolean({
      hidden: true,
      description: 'View logs for only the most recent command',
      default: false,
      env: 'SHOPIFY_FLAG_LAST_COMMAND',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    await log.pageLogs({lastCommand: flags['last-command']})
  }
}
