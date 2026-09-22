import {helpService} from '../services/commands/help/index.js'
import {presentHelpResult} from '../services/commands/help/result.js'
import {helpJsonOutputSchema} from '../services/commands/help/types.js'
import {Args, Flags, loadHelpClass} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'

export default class HelpCommand extends Command {
  static args = {
    command: Args.string({description: 'Command to show help for.', required: false}),
  }

  static descriptionWithMarkdown = 'Display help for Shopify CLI'

  static description = this.descriptionForHelp()

  static usage = `help [command] [flags]`

  static flags = {
    ...jsonFlag,
    'nested-commands': Flags.boolean({
      char: 'n',
      description: 'Include all nested commands in the output.',
      env: 'SHOPIFY_FLAG_CLI_NESTED_COMMANDS',
      default: false,
    }),
  }

  static strict = false

  static get jsonOutputSchema() {
    return helpJsonOutputSchema
  }

  async run(): Promise<void> {
    const {argv, flags} = await this.parse(HelpCommand)
    if (flags.json) {
      const result = await helpService(this.config, argv as string[], flags['nested-commands'])
      presentHelpResult(result)
      return
    }

    const Help = await loadHelpClass(this.config)
    const help = new Help(this.config, {all: flags['nested-commands']})
    await help.showHelp(argv as string[])
  }
}
