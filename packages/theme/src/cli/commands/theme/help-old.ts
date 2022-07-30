import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {cli} from '@shopify/cli-kit'

export default class HelpOld extends Command {
  static description = 'Show help from Ruby CLI'
  static hidden = true

  static flags = {
    ...cli.globalFlags,
    command: Flags.string({
      description: 'The command for which to show CLI2 help.',
      env: 'SHOPIFY_FLAG_COMMAND',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(HelpOld)
    const cli2Args: string[] = ['help', 'theme']
    if (flags.command) cli2Args.push(flags.command)
    await execCLI2(cli2Args)
  }
}
