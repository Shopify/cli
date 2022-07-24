import Command from '@shopify/cli-kit/node/base-command'
import {cli, output} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'

export default class Logs extends Command {
  static description = 'View full debug logs from the Shopify CLI'

  static flags = {
    ...cli.globalFlags,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'last-command': Flags.boolean({
      hidden: false,
      description: 'View logs for the most recent command only',
      default: false,
      env: 'SHOPIFY_FLAG_LAST_COMMAND',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    await output.pageLogs({lastCommand: flags['last-command']})
  }
}
