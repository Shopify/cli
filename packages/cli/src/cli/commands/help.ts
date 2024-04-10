import {Args, Flags, loadHelpClass} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'

export default class HelpCommand extends Command {
  static args = {
    command: Args.string({description: 'Command to show help for.', required: false}),
  }

  static description = 'Display help for Shopify CLI'

  static flags = {
    'nested-commands': Flags.boolean({
      char: 'n',
      description: 'Include all nested commands in the output.',
      env: 'SHOPIFY_FLAG_CLI_NESTED_COMMANDS',
      default: false,
    }),
  }

  static strict = false

  async run(): Promise<void> {
    const {argv, flags} = await this.parse(HelpCommand)
    const Help = await loadHelpClass(this.config)
    const help = new Help(this.config, {all: flags['nested-commands']})
    await help.showHelp(argv as string[])
  }
}
